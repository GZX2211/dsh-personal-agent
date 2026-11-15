// tests/host/sessions/observer.test.ts
//
// 回合边界 → 工单事实的提升规则：完成即结束、失败即失败、用户停止标中断、
// 下次 turn/start 清中断；有未决审批时不能被回合结束埋掉。

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { SessionEvent } from '@deepseek-ai/dsh-session'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Scheduler } from '../../../src/host/dispatcher/scheduler.ts'
import { registerWorkerObserver } from '../../../src/host/sessions/observer.ts'
import { EventStore } from '../../../src/host/store/event-store.ts'
import { createFakeHost, type FakeHost } from '../../support/fake-host.ts'

const TICKET_ID = 't-abcdef1234'
const WORKER_SESSION = 'session-1'

let directory: string
let store: EventStore
let host: FakeHost
let triggers: string[]
let logs: string[]
let disposeObserver: () => void

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'pa-observer-'))
  store = await EventStore.open({ directory })
  host = createFakeHost({ liveSessionIds: [WORKER_SESSION, 'session-other'] })
  triggers = []
  logs = []
  const scheduler: Scheduler = {
    trigger: async reason => {
      triggers.push(reason)
    },
    idle: async () => undefined,
  }
  disposeObserver = registerWorkerObserver({
    ctx: host.ctx,
    store,
    scheduler,
    log: message => logs.push(message),
  })
})

afterEach(async () => {
  disposeObserver()
  store.close()
  await rm(directory, { recursive: true, force: true })
})

function seedRunning(): void {
  store.append({
    type: 'task/queued',
    actor: 'router',
    correlationId: TICKET_ID,
    payload: { ticketId: TICKET_ID, title: '发布新版本', goal: '把 v2 发布到生产', mode: 'dispatch' },
  })
  store.append({
    type: 'task/dispatched',
    actor: 'system',
    correlationId: TICKET_ID,
    payload: { ticketId: TICKET_ID, workerSessionId: WORKER_SESSION, mode: 'dispatch' },
  })
}

function seedPendingApproval(): void {
  store.append({
    type: 'approval/pending',
    actor: 'worker',
    correlationId: TICKET_ID,
    payload: {
      approvalId: 'a-1',
      ticketId: TICKET_ID,
      question: '发布到生产会立刻影响用户。',
      options: [{ label: '发布', description: '立刻上线' }],
      requestedBySessionId: WORKER_SESSION,
    },
  })
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

type TurnEndKind = 'completed' | 'error' | 'aborted' | 'blocked' | 'interrupted' | 'max-tokens' | 'forked'

function turnEnd(turn: number, kind: TurnEndKind): SessionEvent {
  const reasons: Record<TurnEndKind, unknown> = {
    completed: { kind: 'completed' },
    error: { kind: 'error', error: { message: 'boom', code: 'UNKNOWN' } },
    aborted: { kind: 'aborted', reason: { kind: 'user' } },
    blocked: { kind: 'blocked' },
    interrupted: { kind: 'interrupted' },
    'max-tokens': { kind: 'max-tokens' },
    forked: { kind: 'forked' },
  }
  return { type: 'turn/end', seq: 2, time: 1, data: { turn, reason: reasons[kind] } } as unknown as SessionEvent
}

function turnStart(turn: number): SessionEvent {
  return { type: 'turn/start', seq: 1, time: 1, data: { turn } } as unknown as SessionEvent
}

function ticketEvents(): string[] {
  return store.events().map(event => event.type)
}

describe('worker observer', () => {
  it('reports and closes a completed turn', () => {
    seedRunning()

    host.emitSessionEvent(WORKER_SESSION, assistantMessage('发布完成，v2 已上线'))
    host.emitSessionEvent(WORKER_SESSION, turnEnd(1, 'completed'))

    const ticket = store.projection().tickets[0]
    expect(ticket).toMatchObject({ stage: 'ended', outcome: 'completed', report: '发布完成，v2 已上线' })
    expect(triggers).toEqual(['turn-end:completed'])
    const reported = store.events().find(event => event.type === 'task/reported')
    const dispatched = store.events().find(event => event.type === 'task/dispatched')
    expect(reported?.causationId).toBe(dispatched?.eventId)
  })

  it('closes a failed turn without inventing a report', () => {
    seedRunning()

    host.emitSessionEvent(WORKER_SESSION, turnEnd(1, 'error'))

    expect(store.projection().tickets[0]).toMatchObject({ stage: 'ended', outcome: 'failed' })
    expect(store.projection().tickets[0]).not.toHaveProperty('report')
    expect(triggers).toEqual(['turn-end:failed'])
  })

  it('closes a max-tokens turn as failed instead of pretending it completed', () => {
    seedRunning()

    host.emitSessionEvent(WORKER_SESSION, turnEnd(1, 'max-tokens'))

    expect(store.projection().tickets[0]).toMatchObject({ stage: 'ended', outcome: 'failed' })
  })

  it('marks a restart-interrupted turn as interrupted', () => {
    seedRunning()

    host.emitSessionEvent(WORKER_SESSION, turnEnd(1, 'interrupted'))

    expect(store.projection().tickets[0]).toMatchObject({ stage: 'running', interrupted: true })
    expect(store.events().find(event => event.type === 'task/interrupted')?.payload).toMatchObject({
      reason: 'turn-interrupted',
    })
  })

  it('ignores a forked turn and records why', () => {
    seedRunning()

    host.emitSessionEvent(WORKER_SESSION, turnEnd(1, 'forked'))

    expect(ticketEvents()).toEqual(['task/queued', 'task/dispatched'])
    expect(logs.some(message => message.includes('fork'))).toBe(true)
  })

  it('marks the ticket interrupted when the user stops the turn', () => {
    seedRunning()

    host.emitSessionEvent(WORKER_SESSION, turnEnd(1, 'aborted'))

    expect(store.projection().tickets[0]).toMatchObject({ stage: 'running', interrupted: true })
    expect(triggers).toEqual([])
  })

  it('leaves the interruption to the approval flow when an approval is pending', () => {
    seedRunning()
    seedPendingApproval()

    host.emitSessionEvent(WORKER_SESSION, turnEnd(1, 'aborted'))

    expect(ticketEvents()).not.toContain('task/interrupted')
    expect(store.projection().tickets[0]?.stage).toBe('blocked')
  })

  it('clears the interruption on the next turn start', () => {
    seedRunning()
    host.emitSessionEvent(WORKER_SESSION, turnEnd(1, 'aborted'))

    host.emitSessionEvent(WORKER_SESSION, turnStart(2))

    expect(ticketEvents()).toContain('task/resumed')
    expect(store.projection().tickets[0]).not.toHaveProperty('interrupted')
  })

  it('writes nothing on a turn start of a healthy ticket', () => {
    seedRunning()

    host.emitSessionEvent(WORKER_SESSION, turnStart(2))

    expect(ticketEvents()).toEqual(['task/queued', 'task/dispatched'])
  })

  it('keeps the ticket open when a turn ends while an approval is pending', () => {
    seedRunning()
    seedPendingApproval()

    host.emitSessionEvent(WORKER_SESSION, turnEnd(1, 'completed'))

    expect(store.projection().tickets[0]?.stage).toBe('blocked')
    expect(ticketEvents()).not.toContain('task/closed')
    expect(logs.some(message => message.includes('approval is pending'))).toBe(true)
    expect(triggers).toEqual([])
  })

  it('ignores sessions that are not workers of an open ticket', () => {
    seedRunning()

    host.emitSessionEvent('session-other', assistantMessage('无关会话'))
    host.emitSessionEvent('session-other', turnEnd(1, 'completed'))

    expect(ticketEvents()).toEqual(['task/queued', 'task/dispatched'])
    expect(store.projection().tickets[0]?.stage).toBe('running')
  })

  it('logs a blocked turn without writing ticket facts', () => {
    seedRunning()

    host.emitSessionEvent(WORKER_SESSION, turnEnd(1, 'blocked'))

    expect(ticketEvents()).toEqual(['task/queued', 'task/dispatched'])
    expect(logs.some(message => message.includes('archived session gate'))).toBe(true)
  })
})
