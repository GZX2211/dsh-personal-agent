// tests/host/dispatcher/executor.test.ts
//
// 执行器只做三件事，顺序固定：建会话（仅新开）→ 记放行事实 → 投递简报。
// 用真实账本 + 伪宿主会话，断言「账本先确认，副作用后发生」。

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { SessionId } from '@deepseek-ai/dsh-session'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  executeDispatchAction,
  ticketDeliveryRequestId,
  type DispatchDependencies,
} from '../../../src/host/dispatcher/executor.ts'
import { EventStore } from '../../../src/host/store/event-store.ts'
import { createFakeHost, type FakeHost } from '../../support/fake-host.ts'

const TICKET_ID = 't-abcdef1234'

let directory: string
let store: EventStore
let host: FakeHost
let logs: string[]

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'pa-exec-'))
  store = await EventStore.open({ directory })
  host = createFakeHost()
  logs = []
})

afterEach(async () => {
  store.close()
  await rm(directory, { recursive: true, force: true })
})

function deps(): DispatchDependencies {
  return { ctx: host.ctx, stateDirectory: directory, store, log: message => logs.push(message) }
}

function seedQueued(mode: 'dispatch' | 'append' = 'dispatch', workerSessionId?: string): void {
  store.append({
    type: 'task/queued',
    actor: 'router',
    correlationId: TICKET_ID,
    payload: {
      ticketId: TICKET_ID,
      title: '发布新版本',
      goal: '把 v2 发布到生产',
      mode,
      context: '用户原话：今晚发',
      constraints: ['不要改数据库'],
      expectedOutput: '生产返回 200',
      ...(workerSessionId === undefined ? {} : { workerSessionId }),
    },
  })
}

function ticket(): ReturnType<EventStore['projection']>['tickets'][number] {
  const first = store.projection().tickets[0]
  if (first === undefined) throw new Error('ticket was not projected')
  return first
}

describe('executeDispatchAction', () => {
  it('dispatches a queued ticket into a new worker session', async () => {
    seedQueued()
    const queued = store.events()[0]
    if (queued === undefined) throw new Error('queued event missing')

    const outcome = await executeDispatchAction(deps(), { kind: 'start-dispatch', ticketId: TICKET_ID }, ticket())

    expect(outcome).toMatchObject({ ticketId: TICKET_ID, mode: 'dispatch' })
    const session = host.sessions.get(outcome.sessionId)
    expect(session?.title).toBe('发布新版本 · 工单 #abcdef')
    expect(session?.cwd).toBe(join(directory, 'work', TICKET_ID))
    expect(store.projection().tickets[0]).toMatchObject({
      stage: 'running',
      workerSessionId: outcome.sessionId,
      directory: join(directory, 'work', TICKET_ID),
    })
    expect(session?.delivered).toHaveLength(1)
    // 消息 id 由 requestId 派生，是会话侧去重的真正依据（见 sessions/message.ts）。
    expect(session?.delivered[0]?.requestId).toBe(`pa-delivery:${ticketDeliveryRequestId(TICKET_ID)}`)
    expect(session?.delivered[0]?.text).toContain('目标：把 v2 发布到生产')
    expect(session?.delivered[0]?.text).toContain('- 不要改数据库')
    expect(session?.delivered[0]?.text).toContain('验收标准：生产返回 200')

    const dispatched = store.events().find(event => event.type === 'task/dispatched')
    expect(dispatched?.causationId).toBe(queued.eventId)
    expect(dispatched?.payload).toMatchObject({
      ticketId: TICKET_ID,
      workerSessionId: outcome.sessionId,
      mode: 'dispatch',
    })
  })

  it('writes the dispatch fact before delivering the brief', async () => {
    const stages: string[] = []
    host = createFakeHost({
      onFollowup: () => {
        stages.push(store.projection().tickets[0]?.stage ?? 'missing')
      },
    })
    seedQueued()

    await executeDispatchAction(deps(), { kind: 'start-dispatch', ticketId: TICKET_ID }, ticket())

    expect(stages).toEqual(['running'])
  })

  it('appends a queued ticket to an existing worker session without creating one', async () => {
    host = createFakeHost({ liveSessionIds: ['session-9'] })
    seedQueued('append', 'session-9')

    const outcome = await executeDispatchAction(
      deps(),
      { kind: 'start-append', ticketId: TICKET_ID, sessionId: 'session-9' as SessionId },
      ticket(),
    )

    expect(host.createCalls).toBe(0)
    expect(outcome.sessionId).toBe('session-9')
    expect(host.sessions.get('session-9')?.delivered[0]?.text.startsWith('[追加工单] #abcdef')).toBe(true)
    expect(store.events().find(event => event.type === 'task/dispatched')?.payload).toMatchObject({
      mode: 'append',
      workerSessionId: 'session-9',
    })
  })

  it('leaves the ticket queued when the worker session cannot be created', async () => {
    host.failNextCreate('session controller is unavailable')
    seedQueued()

    await expect(
      executeDispatchAction(deps(), { kind: 'start-dispatch', ticketId: TICKET_ID }, ticket()),
    ).rejects.toThrow('session controller is unavailable')

    expect(store.events()).toHaveLength(1)
    expect(store.projection().tickets[0]?.stage).toBe('queued')
  })

  it('does not write the dispatch fact when the append target is gone', async () => {
    seedQueued('append', 'session-ghost')

    await expect(
      executeDispatchAction(
        deps(),
        { kind: 'start-append', ticketId: TICKET_ID, sessionId: 'session-ghost' as SessionId },
        ticket(),
      ),
    ).rejects.toThrow(/no live agent/)

    expect(store.events()).toHaveLength(1)
    expect(store.projection().tickets[0]?.stage).toBe('queued')
  })

  it('keeps the dispatch fact when the brief cannot be delivered', async () => {
    host = createFakeHost({ liveSessionIds: ['session-9'] })
    host.failNextFollowup('session is archived')
    seedQueued('append', 'session-9')

    await expect(
      executeDispatchAction(
        deps(),
        { kind: 'start-append', ticketId: TICKET_ID, sessionId: 'session-9' as SessionId },
        ticket(),
      ),
    ).rejects.toThrow('session is archived')

    expect(store.projection().tickets[0]?.stage).toBe('running')
    expect(logs.some(message => message.includes('delivery failed'))).toBe(true)
  })

  it('prepares the worker after the dispatch fact and before the brief', async () => {
    const order: string[] = []
    host = createFakeHost({
      onFollowup: () => {
        order.push('deliver')
      },
    })
    seedQueued()

    await executeDispatchAction(
      {
        ...deps(),
        onWorkerReady: async sessionId => {
          const dispatched = store.events().filter(event => event.type === 'task/dispatched').length
          order.push(`ready:${dispatched}:${sessionId === 'session-1'}`)
        },
      },
      { kind: 'start-dispatch', ticketId: TICKET_ID },
      ticket(),
    )

    expect(order).toEqual(['ready:1:true', 'deliver'])
  })

  it('does not prepare a worker when the session cannot be created', async () => {
    host.failNextCreate('session controller is unavailable')
    seedQueued()
    const ready = vi.fn()

    await expect(
      executeDispatchAction(
        { ...deps(), onWorkerReady: ready },
        { kind: 'start-dispatch', ticketId: TICKET_ID },
        ticket(),
      ),
    ).rejects.toThrow('session controller is unavailable')

    expect(ready).not.toHaveBeenCalled()
  })
})
