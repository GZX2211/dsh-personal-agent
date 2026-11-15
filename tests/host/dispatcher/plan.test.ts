// tests/host/dispatcher/plan.test.ts
//
// 放行规则是纯函数：先追加后新开、FIFO、槽位与 worker 忙碌共同约束。
// 这里穷举契约允许的组合，而不是只验证一条正常路径。

import type { SessionId } from '@deepseek-ai/dsh-session'
import { describe, expect, it } from 'vitest'
import {
  planDispatch,
  predictQueueReason,
  type QueuedTicket,
  type WorkerState,
} from '../../../src/host/dispatcher/plan.ts'

const sid = (value: string): SessionId => value as SessionId

function worker(sessionId: string, busy: boolean): WorkerState {
  return { sessionId: sid(sessionId), busy }
}

function appendTicket(ticketId: string, sessionId: string, enqueuedSeq: number): QueuedTicket {
  return { ticketId, mode: 'append', workerSessionId: sid(sessionId), enqueuedSeq }
}

function dispatchTicket(ticketId: string, enqueuedSeq: number): QueuedTicket {
  return { ticketId, mode: 'dispatch', enqueuedSeq }
}

describe('planDispatch', () => {
  it('returns no action for an empty queue', () => {
    expect(planDispatch([], [worker('session-1', false)], 5)).toEqual([])
  })

  it('starts dispatches in enqueue order while capacity remains', () => {
    const actions = planDispatch(
      [dispatchTicket('t-2', 2), dispatchTicket('t-1', 1)],
      [],
      5,
    )

    expect(actions).toEqual([
      { kind: 'start-dispatch', ticketId: 't-1' },
      { kind: 'start-dispatch', ticketId: 't-2' },
    ])
  })

  it('never exceeds the capacity', () => {
    const actions = planDispatch(
      [dispatchTicket('t-1', 1), dispatchTicket('t-2', 2), dispatchTicket('t-3', 3)],
      [],
      2,
    )

    expect(actions).toEqual([
      { kind: 'start-dispatch', ticketId: 't-1' },
      { kind: 'start-dispatch', ticketId: 't-2' },
    ])
  })

  it('starts an append on an idle worker', () => {
    const actions = planDispatch([appendTicket('t-1', 'session-1', 1)], [worker('session-1', false)], 5)

    expect(actions).toEqual([{ kind: 'start-append', ticketId: 't-1', sessionId: sid('session-1') }])
  })

  it('keeps an append queued while its worker is busy', () => {
    expect(planDispatch([appendTicket('t-1', 'session-1', 1)], [worker('session-1', true)], 5)).toEqual([])
  })

  it('prioritises appends over older dispatches', () => {
    const actions = planDispatch(
      [dispatchTicket('t-old', 1), appendTicket('t-append', 'session-1', 2)],
      [worker('session-1', false)],
      1,
    )

    expect(actions).toEqual([{ kind: 'start-append', ticketId: 't-append', sessionId: sid('session-1') }])
  })

  it('allows only one append per worker in one round', () => {
    const actions = planDispatch(
      [appendTicket('t-1', 'session-1', 1), appendTicket('t-2', 'session-1', 2)],
      [worker('session-1', false)],
      5,
    )

    expect(actions).toEqual([{ kind: 'start-append', ticketId: 't-1', sessionId: sid('session-1') }])
  })

  it('skips an append whose worker is unknown', () => {
    expect(planDispatch([appendTicket('t-1', 'session-gone', 1)], [], 5)).toEqual([])
  })

  it('consumes capacity for appends before dispatches', () => {
    const actions = planDispatch(
      [dispatchTicket('t-dispatch', 1), appendTicket('t-append', 'session-1', 2)],
      [worker('session-1', false)],
      1,
    )

    expect(actions.map(action => action.kind)).toEqual(['start-append'])
  })

  it('lets a skipped busy append leave room for a dispatch', () => {
    const actions = planDispatch(
      [appendTicket('t-append', 'session-1', 1), dispatchTicket('t-dispatch', 2)],
      [worker('session-1', true)],
      1,
    )

    expect(actions).toEqual([{ kind: 'start-dispatch', ticketId: 't-dispatch' }])
  })

  it('treats a negative capacity as no capacity', () => {
    expect(planDispatch([dispatchTicket('t-1', 1)], [], -1)).toEqual([])
  })
})

describe('predictQueueReason', () => {
  it('reports a busy append target', () => {
    expect(predictQueueReason({ mode: 'append', workerBusy: true, freeSlots: 5 })).toBe('worker-busy')
  })

  it('reports a full capacity', () => {
    expect(predictQueueReason({ mode: 'dispatch', workerBusy: false, freeSlots: 0 })).toBe('capacity-full')
  })

  it('returns undefined when the ticket can start immediately', () => {
    expect(predictQueueReason({ mode: 'dispatch', workerBusy: false, freeSlots: 1 })).toBeUndefined()
  })

  it('prefers the busy worker over a full capacity', () => {
    expect(predictQueueReason({ mode: 'append', workerBusy: true, freeSlots: 0 })).toBe('worker-busy')
  })
})
