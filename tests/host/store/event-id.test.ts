// tests/host/store/event-id.test.ts
//
// eventId 是账本的幂等键：同一条事实必须得到同一个 id，展示字段变化不得改变身份，
// 事实字段变化必须改变身份。

import { describe, expect, it } from 'vitest'
import type { EventDraft } from '../../../src/shared/events.ts'
import { deriveEventId } from '../../../src/host/store/event-id.ts'

type QueuedDraft = Extract<EventDraft, { type: 'task/queued' }>

function queuedDraft(
  payload: Partial<QueuedDraft['payload']> = {},
  extra: Partial<Omit<QueuedDraft, 'payload'>> = {},
): QueuedDraft {
  return {
    type: 'task/queued',
    actor: 'router',
    correlationId: 'corr-1',
    payload: {
      ticketId: 't-abcdef1234',
      title: '发布新版本',
      goal: '把 v2 发出去',
      mode: 'dispatch',
      ...payload,
    },
    ...extra,
  }
}

describe('deriveEventId', () => {
  it('returns 32 lowercase hex characters', () => {
    expect(deriveEventId(queuedDraft())).toMatch(/^[0-9a-f]{32}$/)
  })

  it('is deterministic for the same draft', () => {
    expect(deriveEventId(queuedDraft())).toBe(deriveEventId(queuedDraft()))
  })

  it('ignores display-only payload fields', () => {
    const before = deriveEventId(queuedDraft({ title: '发布新版本' }))
    const after = deriveEventId(queuedDraft({ title: '发布 v2 版本', goal: '换一种说法' }))

    expect(after).toBe(before)
  })

  it('changes with the ticket it belongs to', () => {
    expect(deriveEventId(queuedDraft({ ticketId: 't-1111111111' }))).not.toBe(
      deriveEventId(queuedDraft({ ticketId: 't-2222222222' })),
    )
  })

  it('changes with the correlation it belongs to', () => {
    expect(deriveEventId(queuedDraft({}, { correlationId: 'corr-1' }))).not.toBe(
      deriveEventId(queuedDraft({}, { correlationId: 'corr-2' })),
    )
  })

  it('changes with the causing event', () => {
    expect(deriveEventId(queuedDraft({}, { causationId: 'a'.repeat(32) }))).not.toBe(
      deriveEventId(queuedDraft({}, { causationId: 'b'.repeat(32) })),
    )
  })

  it('changes with the event type', () => {
    const closed: EventDraft = {
      type: 'task/closed',
      actor: 'system',
      correlationId: 'corr-1',
      payload: { ticketId: 't-abcdef1234', outcome: 'completed' },
    }

    expect(deriveEventId(closed)).not.toBe(deriveEventId(queuedDraft()))
  })

  it('changes with a keyed fact such as a report summary', () => {
    const reported = (summary: string): EventDraft => ({
      type: 'task/reported',
      actor: 'worker',
      correlationId: 'corr-1',
      payload: { ticketId: 't-abcdef1234', summary, status: 'done' },
    })

    expect(deriveEventId(reported('发布完成'))).not.toBe(deriveEventId(reported('发布失败')))
  })

  it('treats a missing optional key field as absent', () => {
    const explicit: EventDraft = {
      type: 'signal/received',
      actor: 'system',
      correlationId: 'corr-1',
      payload: { kind: 'user-message', delivered: true, receivedAt: 1, sourceId: undefined },
    }
    const implicit: EventDraft = {
      type: 'signal/received',
      actor: 'system',
      correlationId: 'corr-1',
      payload: { kind: 'user-message', delivered: true, receivedAt: 1 },
    }

    expect(deriveEventId(explicit)).toBe(deriveEventId(implicit))
  })

  it('does not hash the actor of the write', () => {
    // 身份属于事实本身：同一事实由系统补记或由工人写入，不该各成一条。
    expect(deriveEventId(queuedDraft({}, { actor: 'router' }))).toBe(
      deriveEventId(queuedDraft({}, { actor: 'system' })),
    )
  })

  it('changes when the arrival time of a signal changes', () => {
    const signal = (receivedAt: number): EventDraft => ({
      type: 'signal/received',
      actor: 'system',
      correlationId: 'corr-1',
      payload: { kind: 'user-message', delivered: true, receivedAt, text: '你好' },
    })

    expect(deriveEventId(signal(1))).not.toBe(deriveEventId(signal(2)))
  })
})
