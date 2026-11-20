// tests/integration/signal-flow.test.ts
//
// 信号管道的端到端协作：一条消息进入 router 的 inbox → 记账 → 被某个回合取用 →
// 派发工具认领它（或回合结束兜底）→ 快照上出现带结局的信号。

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { UserMessage } from '@deepseek-ai/dsh-llm'
import type { SessionEvent } from '@deepseek-ai/dsh-session'
import type { ToolRunContext } from '@deepseek-ai/dsh-tools'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createScheduler } from '../../src/host/dispatcher/scheduler.ts'
import { createClaimRegistry, type ClaimRegistry } from '../../src/host/signals/claim.ts'
import { registerRouterSignalObserver } from '../../src/host/signals/observer.ts'
import { EventStore } from '../../src/host/store/event-store.ts'
import { createTaskRouteTool } from '../../src/host/tools/pa_task_route/index.ts'
import { createFakeHost, type FakeHost } from '../support/fake-host.ts'

const ROUTER_SESSION = 'session-router'

let directory: string
let store: EventStore
let host: FakeHost
let claims: ClaimRegistry
let tool: ReturnType<typeof createTaskRouteTool>
let disposeObserver: () => void

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'pa-signal-flow-'))
  store = await EventStore.open({ directory })
  host = createFakeHost({ liveSessionIds: [ROUTER_SESSION] })
  host.setTurn(ROUTER_SESSION, 1)
  claims = createClaimRegistry()
  disposeObserver = registerRouterSignalObserver({
    ctx: host.ctx,
    store,
    claims,
    currentRouterSessionId: () => ROUTER_SESSION,
  })
  const scheduler = createScheduler({
    ctx: host.ctx,
    store,
    stateDirectory: directory,
    maxWorkers: () => 5,
    log: () => undefined,
  })
  tool = createTaskRouteTool({ ctx: host.ctx, store, scheduler, claims, maxWorkers: () => 5 })
})

afterEach(async () => {
  disposeObserver()
  store.close()
  await rm(directory, { recursive: true, force: true })
})

function userMessage(text: string): UserMessage {
  return {
    id: 'msg-1',
    role: 'user',
    content: [{ type: 'text', text }],
    source: { kind: 'user' },
  } as unknown as UserMessage
}

function arrive(message: UserMessage): void {
  host.emitSessionEvent(ROUTER_SESSION, {
    type: 'agent/inbox/spliced',
    seq: 1,
    time: 0,
    data: { target: 'next-turn', start: 0, inserted: [message] },
  } as unknown as SessionEvent)
  const agent = host.sessions.get(ROUTER_SESSION)?.agent
  if (agent === undefined) throw new Error('fake host has no router session')
  host.emitEvent('agent/inbox/claimed', { agent, message, turn: 1 })
}

function endTurn(): void {
  host.emitSessionEvent(ROUTER_SESSION, {
    type: 'turn/end',
    seq: 2,
    time: 1,
    data: { turn: 1, reason: { kind: 'completed' } },
  } as unknown as SessionEvent)
}

async function dispatch(args: Record<string, unknown>): Promise<{ ticketId: string; signalId?: string }> {
  const execution = {
    signal: new AbortController().signal,
    agent: host.sessions.get(ROUTER_SESSION)?.agent,
    callId: 'call-1',
    rootCallId: 'call-1',
    name: 'pa_task_route',
    arguments: {},
    token: Symbol('call'),
  } as unknown as ToolRunContext
  return (await tool.execute(args, execution)) as { ticketId: string; signalId?: string }
}

describe('signal flow', () => {
  it('links a dispatched request to the ticket it produced', async () => {
    arrive(userMessage('帮我把 README 改一下'))

    const result = await dispatch({ action: 'dispatch', title: '改 README', goal: '更新使用说明' })
    endTurn()

    const signal = store.projection().signals[0]
    expect(signal).toMatchObject({
      kind: 'user-message',
      text: '帮我把 README 改一下',
      decision: { action: 'dispatch', ticketId: result.ticketId },
    })
    expect(result.signalId).toBe(signal?.signalId)
  })

  it('answers a chat message at the end of its turn', async () => {
    arrive(userMessage('今天辛苦了'))
    endTurn()

    expect(store.projection().signals[0]?.decision).toMatchObject({
      action: 'reply',
      inferred: true,
    })
  })

  it('keeps the statistics in step with the recorded signals', async () => {
    arrive(userMessage('帮我把 README 改一下'))
    await dispatch({ action: 'dispatch', title: '改 README', goal: '更新使用说明' })
    endTurn()

    expect(store.projection().stats.signals).toEqual({ delivered: 1, filtered: 0, total: 1 })
    expect(store.projection().stats.tickets.total).toBe(1)
  })
})
