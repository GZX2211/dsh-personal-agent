// tests/integration/ticket-flow.test.ts
//
// 端到端协作：router 工具 → 调度器 → worker 会话 → 审批阻塞 → 人决定 → 回合结束。
// 用真实账本、真实调度/观察/审批模块，只有宿主服务是伪实现。

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { SessionEvent, SessionId } from '@deepseek-ai/dsh-session'
import type { ToolDefinition, ToolRunContext } from '@deepseek-ai/dsh-tools'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ResolverRegistry } from '../../src/host/approvals/resolvers.ts'
import { createApprovalDecider } from '../../src/host/approvals/service.ts'
import { createScheduler, type Scheduler } from '../../src/host/dispatcher/scheduler.ts'
import { createAgentDecorator } from '../../src/host/sessions/decorate.ts'
import { registerWorkerObserver } from '../../src/host/sessions/observer.ts'
import { EventStore } from '../../src/host/store/event-store.ts'
import { createFakeHost, type FakeHost } from '../support/fake-host.ts'

const ROUTER_SESSION = 'session-router'
const CLOCK = 1_700_000_000_000

let directory: string
let store: EventStore
let host: FakeHost
let scheduler: Scheduler
let resolvers: ResolverRegistry
let decider: ReturnType<typeof createApprovalDecider>
let disposeObserver: () => void
let disposeDecorator: () => void

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'pa-flow-'))
  store = await EventStore.open({ directory })
  host = createFakeHost({
    liveSessionIds: [ROUTER_SESSION],
    visibleTools: ['pwsh', 'write', 'present', 'ask_user_question'],
    // 真实宿主：sessionController.create 在返回前就发布 agent/created。
    emitAgentCreatedOnCreate: true,
  })
  resolvers = new ResolverRegistry()
  decider = createApprovalDecider({ ctx: host.ctx, store, resolvers, now: () => CLOCK })
  let prepareWorker: ((sessionId: SessionId) => Promise<void>) | undefined
  scheduler = createScheduler({
    ctx: host.ctx,
    store,
    stateDirectory: directory,
    maxWorkers: 5,
    onWorkerReady: async sessionId => {
      await prepareWorker?.(sessionId)
    },
  })
  const decorator = createAgentDecorator({
    ctx: host.ctx,
    store,
    scheduler,
    resolvers,
    maxWorkers: 5,
    currentRouterSessionId: () => ROUTER_SESSION,
  })
  prepareWorker = async sessionId => {
    const resolved = await host.ctx.sessionController.resolveAgent(sessionId)
    if ('agent' in resolved) decorator.decorate(resolved.agent)
  }
  disposeDecorator = decorator.dispose
  disposeObserver = registerWorkerObserver({ ctx: host.ctx, store, scheduler })
  host.emitEvent('agent/created', { agent: host.sessions.get(ROUTER_SESSION)?.agent, source: 'fresh' })
})

afterEach(async () => {
  disposeObserver()
  disposeDecorator()
  store.close()
  await rm(directory, { recursive: true, force: true })
})

function agent(sessionId: string) {
  const found = host.sessions.get(sessionId)?.agent
  if (found === undefined) throw new Error(`missing fake agent ${sessionId}`)
  return found
}

async function callTool(
  sessionId: string,
  name: string,
  args: unknown,
  signal: AbortSignal = new AbortController().signal,
): Promise<unknown> {
  const definition = agent(sessionId).toolImpls.get(name) as ToolDefinition | undefined
  if (definition === undefined) throw new Error(`tool ${name} is not registered for ${sessionId}`)
  return definition.execute(args, {
    signal,
    agent: agent(sessionId),
    callId: 'call-1',
    rootCallId: 'call-1',
    name,
    arguments: args,
    token: Symbol('call'),
  } as unknown as ToolRunContext)
}

async function waitUntil(condition: () => boolean, message: string): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (condition()) return
    await new Promise(resolve => setTimeout(resolve, 5))
  }
  throw new Error(message)
}

async function waitForEvent(type: string): Promise<void> {
  await waitUntil(
    () => store.events().some(event => event.type === type),
    `event ${type} was not written`,
  )
}

function assistantMessage(text: string): SessionEvent {
  return {
    type: 'assistant/message',
    seq: 1,
    time: 0,
    data: {
      turn: 1,
      step: 1,
      message: { id: 'm-1', role: 'assistant', content: [{ type: 'text', text }], source: { kind: 'model' } },
      stream: [],
    },
  } as unknown as SessionEvent
}

function turnEndCompleted(): SessionEvent {
  return { type: 'turn/end', seq: 2, time: 1, data: { turn: 1, reason: { kind: 'completed' } } } as unknown as SessionEvent
}

async function dispatch(ticketTitle: string): Promise<{ ticketId: string; status: string; sessionId?: string; queueReason?: string }> {
  return (await callTool(ROUTER_SESSION, 'pa_task_route', {
    action: 'dispatch',
    title: ticketTitle,
    goal: `完成：${ticketTitle}`,
    context: '用户原话：尽快',
    constraints: ['不要动数据库'],
    expectedOutput: '结果可验证',
  })) as { ticketId: string; status: string; sessionId?: string; queueReason?: string }
}

describe('ticket flow', () => {
  it('runs dispatch → approval → decision → finish', async () => {
    const routed = await dispatch('发布新版本')

    expect(routed.status).toBe('running')
    expect(routed.sessionId).toMatch(/^session-/)
    expect(store.projection().tickets[0]).toMatchObject({ stage: 'running', workerSessionId: routed.sessionId })
    const workerSessionId = routed.sessionId ?? ''
    const brief = agent(workerSessionId).inbox.nextTurn
    expect(brief).toHaveLength(1)
    // 装饰必须早于简报投递：worker 第一步就要看到自己的提示词与审批工具。
    expect(agent(workerSessionId).toolNames).toEqual(['pa_approval_submit'])
    expect(agent(workerSessionId).sections).toHaveLength(1)

    // A2：worker 提交审批并阻塞。
    const controller = new AbortController()
    const approvalPromise = callTool(
      workerSessionId,
      'pa_approval_submit',
      {
        question: '发布到生产会立刻影响用户。',
        options: [
          { label: '发布', description: '立刻上线' },
          { label: '等等', description: '继续观察' },
        ],
        attachments: ['D:/pa-work/notes.md'],
        risk: 'high',
      },
      controller.signal,
    )
    await waitForEvent('approval/pending')
    const approval = store.projection().approvals[0]
    if (approval === undefined) throw new Error('approval was not projected')
    expect(approval.attachments).toEqual(['D:/pa-work/notes.md'])
    expect(store.projection().tickets[0]?.stage).toBe('blocked')

    // A3：人决定 → inline 送达 → 工具继续。
    const decided = await decider.decide(approval.id, {
      kind: 'selected',
      index: 0,
      answer: '现在就发',
    })
    expect(decided).toEqual({ status: 200, body: { ok: true, transport: 'inline' } })
    await expect(approvalPromise).resolves.toMatchObject({
      decision: { kind: 'selected', index: 0, label: '发布', answer: '现在就发' },
    })
    expect(store.projection().tickets[0]?.stage).toBe('running')
    expect(store.projection().approvals[0]?.decidedAt).toBe(CLOCK)

    // A4：回合正常结束 → 汇报 + 关闭。
    host.emitSessionEvent(workerSessionId, assistantMessage('发布完成，v2 已上线'))
    host.emitSessionEvent(workerSessionId, turnEndCompleted())

    expect(store.projection().tickets[0]).toMatchObject({
      stage: 'ended',
      outcome: 'completed',
      report: '发布完成，v2 已上线',
    })
    expect(store.projection().stats.tickets.ended).toBe(1)
  })

  it('queues beyond capacity and releases the next ticket when a turn ends', async () => {
    const dispatched: { ticketId: string; status: string; sessionId?: string; queueReason?: string }[] = []
    for (let index = 1; index <= 6; index += 1) dispatched.push(await dispatch(`任务 ${index}`))

    expect(dispatched.slice(0, 5).every(item => item.status === 'running')).toBe(true)
    expect(dispatched[5]).toMatchObject({ status: 'queued', queueReason: 'capacity-full' })
    expect(store.projection().stats.tickets.running).toBe(5)
    expect(store.projection().stats.tickets.queued).toBe(1)

    const firstWorker = dispatched[0]?.sessionId ?? ''
    host.emitSessionEvent(firstWorker, assistantMessage('第一单完成'))
    host.emitSessionEvent(firstWorker, turnEndCompleted())
    await scheduler.idle()
    await waitUntil(
      () => store.projection().tickets[0]?.stage === 'ended',
      'the first ticket never ended',
    )

    expect(store.projection().tickets[0]?.stage).toBe('ended')
    expect(store.projection().tickets[5]?.stage).toBe('running')
    expect(agent(store.projection().tickets[5]?.workerSessionId ?? '').inbox.nextTurn).toHaveLength(1)
  })
})
