// tests/host/perception/timers.test.ts
//
// 定时来源只读分区：官方调度器的任务里，只有投递到 router 会话的那些才算个人代理的
// 输入。节奏结构在这里重建，计数仍来自信号事实（与感知来源同一口径）。

import { describe, expect, it } from 'vitest'
import {
  toTimerSourceViews,
  type ScheduleCatalogEntry,
} from '../../../src/host/perception/timers.ts'

const ROUTER = 'session-router'

function entry(overrides: Partial<ScheduleCatalogEntry> = {}): ScheduleCatalogEntry {
  return {
    id: 'schedule-1',
    kind: 'daily',
    title: '每日提醒',
    scheduledAt: '2026-11-20T01:00:00.000Z',
    status: 'active',
    target: { kind: 'session', sessionId: ROUTER },
    time: '09:00',
    timeZone: 'Asia/Shanghai',
    ...overrides,
  }
}

describe('toTimerSourceViews', () => {
  it('keeps only tasks delivered to the router session', () => {
    const views = toTimerSourceViews(
      [
        entry({ id: 'schedule-1' }),
        entry({ id: 'schedule-2', target: { kind: 'session', sessionId: 'session-other' } }),
        entry({ id: 'schedule-3', target: { kind: 'new' } }),
        entry({ id: 'schedule-4', target: { kind: 'new_once' } }),
      ],
      ROUTER,
      new Map(),
    )

    expect(views.map(view => view.scheduleId)).toEqual(['schedule-1'])
  })

  it('returns nothing when the router identity is still unknown', () => {
    expect(toTimerSourceViews([entry()], undefined, new Map())).toEqual([])
  })

  it('maps the task state to the active flag', () => {
    const views = toTimerSourceViews(
      [entry({ id: 'a', status: 'active' }), entry({ id: 'b', status: 'paused' }), entry({ id: 'c', status: 'ended' })],
      ROUTER,
      new Map(),
    )

    expect(views.map(view => view.active)).toEqual([true, false, false])
  })

  it('rebuilds the timing of a daily task', () => {
    const [view] = toTimerSourceViews([entry()], ROUTER, new Map())

    expect(view?.timing).toEqual({ kind: 'daily', time: '09:00', timeZone: 'Asia/Shanghai' })
  })

  it('rebuilds the timing of every supported kind', () => {
    const views = toTimerSourceViews(
      [
        entry({ id: 't-after', kind: 'after', afterSeconds: 60 }),
        entry({ id: 't-at', kind: 'at', scheduledAt: '2026-11-20T01:00:00.000Z' }),
        entry({ id: 't-every', kind: 'every', everySeconds: 120 }),
        entry({ id: 't-weekly', kind: 'weekly', time: '09:00', timeZone: 'Asia/Shanghai', weekdays: [1, 3] }),
        entry({ id: 't-cron', kind: 'cron', expression: '0 9 * * *', timeZone: 'Asia/Shanghai' }),
        entry({ id: 't-rrule', kind: 'rrule', rrule: 'FREQ=DAILY' }),
      ],
      ROUTER,
      new Map(),
    )

    expect(views.map(view => view.timing)).toEqual([
      { kind: 'after', afterSeconds: 60 },
      { kind: 'at', scheduledAt: '2026-11-20T01:00:00.000Z' },
      { kind: 'every', everySeconds: 120 },
      { kind: 'weekly', time: '09:00', timeZone: 'Asia/Shanghai', weekdays: [1, 3] },
      { kind: 'cron', expression: '0 9 * * *', timeZone: 'Asia/Shanghai' },
      { kind: 'rrule', rrule: 'FREQ=DAILY' },
    ])
  })

  it('drops a task whose timing shape it does not understand', () => {
    const views = toTimerSourceViews([entry({ id: 't-future', kind: 'monthly' })], ROUTER, new Map())

    expect(views).toEqual([])
  })

  it('reads the next occurrence from the scheduled time', () => {
    const [view] = toTimerSourceViews([entry()], ROUTER, new Map())

    expect(view?.nextAt).toBe(Date.parse('2026-11-20T01:00:00.000Z'))
  })

  it('leaves the next occurrence out when the timestamp is unusable', () => {
    const [view] = toTimerSourceViews([entry({ scheduledAt: '不是时间' })], ROUTER, new Map())

    expect(view).not.toHaveProperty('nextAt')
  })

  it('takes the delivery counts from the recorded signals', () => {
    const [view] = toTimerSourceViews(
      [entry()],
      ROUTER,
      new Map([['schedule-1', { delivered: 3, lastDeliveredAt: 1_700_000_000_000 }]]),
    )

    expect(view).toMatchObject({ deliveredCount: 3, lastDeliveredAt: 1_700_000_000_000 })
  })

  it('reports zero deliveries for a task that never fired', () => {
    const [view] = toTimerSourceViews([entry()], ROUTER, new Map())

    expect(view).toMatchObject({ deliveredCount: 0 })
    expect(view).not.toHaveProperty('lastDeliveredAt')
  })
})
