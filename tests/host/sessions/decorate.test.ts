// tests/host/sessions/decorate.test.ts
//
// 角色装饰按会话身份装配：router 得到派发与查询、worker 得到审批；不相关会话
// 不被碰；重复 agent/created 不重复注册；agent 销毁时注册全部卸载。

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ResolverRegistry } from '../../../src/host/approvals/resolvers.ts'
import type { Scheduler } from '../../../src/host/dispatcher/scheduler.ts'
import { createAgentDecorator, decorateLiveWorkerSessions, roleForSession, type SessionRole } from '../../../src/host/sessions/decorate.ts'
import { createClaimRegistry } from '../../../src/host/signals/claim.ts'
import { EventStore } from '../../../src/host/store/event-store.ts'
import { createFakeHost, sectionText, type FakeHost } from '../../support/fake-host.ts'
import { perceptionStub } from '../../support/perception-stub.ts'

const WORKER_TICKET = 't-abcdef1234'
const WORKER_SESSION = 'session-worker'

let directory: string
let store: EventStore
let host: FakeHost
let routerSessionId: string | undefined
let logs: string[]
let prompts: Record<SessionRole, string>
const scheduler: Scheduler = { trigger: async () => undefined, idle: async () => undefined }

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'pa-decorate-'))
  store = await EventStore.open({ directory })
  host = createFakeHost({
    liveSessionIds: ['session-router', WORKER_SESSION],
    visibleTools: ['pwsh', 'write', 'read', 'present', 'ask_user_question'],
  })
  routerSessionId = 'session-router'
  logs = []
  prompts = { router: '路由角色提示词', worker: '执行角色提示词' }
})

afterEach(async () => {
  store.close()
  await rm(directory, { recursive: true, force: true })
})

function seedWorkerTicket(): void {
  store.append({
    type: 'task/queued',
    actor: 'router',
    correlationId: WORKER_TICKET,
    payload: { ticketId: WORKER_TICKET, title: '发布', goal: '发布出去', mode: 'dispatch' },
  })
  store.append({
    type: 'task/dispatched',
    actor: 'system',
    correlationId: WORKER_TICKET,
    payload: { ticketId: WORKER_TICKET, workerSessionId: WORKER_SESSION, mode: 'dispatch' },
  })
}

function makeDecorator(): ReturnType<typeof createAgentDecorator> {
  return createAgentDecorator({
    ctx: host.ctx,
    store,
    scheduler,
    resolvers: new ResolverRegistry(),
    claims: createClaimRegistry(),
    perception: perceptionStub(),
    settings: { composePrompt: role => prompts[role] },
    maxWorkers: 5,
    currentRouterSessionId: () => routerSessionId,
    log: message => logs.push(message),
  })
}

function emitCreated(sessionId: string): void {
  const agent = host.sessions.get(sessionId)?.agent
  if (agent === undefined) throw new Error(`missing fake agent ${sessionId}`)
  host.emitEvent('agent/created', { agent, source: 'fresh' })
}

describe('roleForSession', () => {
  it('identifies the router, the worker and nobody else', () => {
    seedWorkerTicket()
    const projection = store.projection()

    expect(roleForSession('session-router', 'session-router', projection)).toBe('router')
    expect(roleForSession(WORKER_SESSION, 'session-router', projection)).toBe('worker')
    expect(roleForSession('session-other', 'session-router', projection)).toBeUndefined()
  })

  it('keeps a worker session decorated after its ticket has ended', () => {
    seedWorkerTicket()
    store.append({
      type: 'task/closed',
      actor: 'system',
      correlationId: WORKER_TICKET,
      payload: { ticketId: WORKER_TICKET, outcome: 'completed' },
    })

    expect(roleForSession(WORKER_SESSION, 'session-router', store.projection())).toBe('worker')
  })
})

describe('createAgentDecorator', () => {
  it('decorates the router with dispatch, ledger query and restricted tools', () => {
    const decorator = makeDecorator()
    emitCreated('session-router')

    const agent = host.sessions.get('session-router')?.agent
    expect(agent?.sections).toHaveLength(1)
    expect(agent?.sections[0]?.name).toBe('personal-agent/router')
    expect(sectionText(agent!.sections[0]!)).toBe('路由角色提示词')
    expect(agent?.toolNames).toEqual([
      'pa_task_route',
      'pa_ledger_query',
      'pa_source_create',
      'pa_source_update',
      'pa_source_toggle',
      'pa_source_remove',
    ])
    expect(agent?.restrictions).toEqual([
      { deny: ['pwsh', 'write', 'present', 'ask_user_question'] },
    ])
    decorator.dispose()
  })

  it('decorates a worker with the approval tool only', () => {
    seedWorkerTicket()
    const decorator = makeDecorator()
    emitCreated(WORKER_SESSION)

    const agent = host.sessions.get(WORKER_SESSION)?.agent
    expect(agent?.sections[0]?.name).toBe('personal-agent/worker')
    expect(sectionText(agent!.sections[0]!)).toBe('执行角色提示词')
    expect(agent?.toolNames).toEqual(['pa_approval_submit'])
    expect(agent?.restrictions).toEqual([{ deny: ['ask_user_question', 'present'] }])
    decorator.dispose()
  })

  it('reads the current prompt each time the system prompt is assembled', () => {
    const decorator = makeDecorator()
    emitCreated('session-router')
    const section = host.sessions.get('session-router')!.agent.sections[0]!

    expect(sectionText(section)).toBe('路由角色提示词')
    prompts.router = '更新后的路由提示词'
    expect(sectionText(section)).toBe('更新后的路由提示词')
    decorator.dispose()
  })

  it('leaves unrelated sessions untouched', () => {
    const decorator = makeDecorator()
    emitCreated('session-router')
    emitCreated(WORKER_SESSION)

    expect(host.sessions.get(WORKER_SESSION)?.agent.sections).toEqual([])
    expect(host.sessions.get(WORKER_SESSION)?.agent.toolNames).toEqual([])
    decorator.dispose()
  })

  it('is idempotent for repeated agent/created events', () => {
    const decorator = makeDecorator()
    emitCreated('session-router')
    emitCreated('session-router')

    expect(host.sessions.get('session-router')?.agent.toolNames).toHaveLength(6)
    expect(host.sessions.get('session-router')?.agent.sections).toHaveLength(1)
    decorator.dispose()
  })

  it('decorates an existing router agent once its identity is known', () => {
    routerSessionId = undefined
    const decorator = makeDecorator()
    emitCreated('session-router')
    expect(host.sessions.get('session-router')?.agent.sections).toEqual([])

    routerSessionId = 'session-router'
    const agent = host.sessions.get('session-router')?.agent
    if (agent === undefined) throw new Error('missing router agent')
    decorator.decorate(agent as never)

    expect(host.sessions.get('session-router')?.agent.toolNames).toEqual([
      'pa_task_route',
      'pa_ledger_query',
      'pa_source_create',
      'pa_source_update',
      'pa_source_toggle',
      'pa_source_remove',
    ])
    decorator.dispose()
  })

  it('releases every registration when the agent is disposed', () => {
    const decorator = makeDecorator()
    emitCreated('session-router')
    const agent = host.sessions.get('session-router')?.agent

    host.emitEvent('agent/disposed', { agent })

    expect(agent?.disposed).toBe(true)
    decorator.dispose()
  })

  it('skips restrictions when none of the candidates are visible', () => {
    host = createFakeHost({ liveSessionIds: ['session-router'], visibleTools: ['read'] })
    const decorator = makeDecorator()
    emitCreated('session-router')

    expect(host.sessions.get('session-router')?.agent.restrictions).toEqual([])
    decorator.dispose()
  })
})

describe('decorateLiveWorkerSessions', () => {
  it('decorates a live worker whose agent/created has already happened', () => {
    seedWorkerTicket()
    const decorator = makeDecorator()

    const count = decorateLiveWorkerSessions({
      ctx: host.ctx,
      store,
      decorator,
      log: message => logs.push(message),
    })

    const agent = host.sessions.get(WORKER_SESSION)?.agent
    expect(count).toBe(1)
    expect(agent?.toolNames).toEqual(['pa_approval_submit'])
    expect(agent?.sections).toHaveLength(1)
    decorator.dispose()
  })

  it('leaves live sessions that no ticket binds', () => {
    const decorator = makeDecorator()

    const count = decorateLiveWorkerSessions({ ctx: host.ctx, store, decorator })

    expect(count).toBe(0)
    expect(host.sessions.get(WORKER_SESSION)?.agent.sections).toEqual([])
    decorator.dispose()
  })

  it('re-decorates a worker whose ticket has already ended', () => {
    seedWorkerTicket()
    store.append({
      type: 'task/closed',
      actor: 'system',
      correlationId: WORKER_TICKET,
      payload: { ticketId: WORKER_TICKET, outcome: 'completed' },
    })
    const decorator = makeDecorator()

    const count = decorateLiveWorkerSessions({ ctx: host.ctx, store, decorator })

    expect(count).toBe(1)
    expect(host.sessions.get(WORKER_SESSION)?.agent.toolNames).toEqual(['pa_approval_submit'])
    decorator.dispose()
  })
})
