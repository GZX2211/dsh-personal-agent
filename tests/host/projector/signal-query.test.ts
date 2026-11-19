// tests/host/projector/signal-query.test.ts
//
// 事件页的历史检索：快照只带最近一段，搜索必须能翻到更早的账本事实。
// 这里验证全量投影与查询的组合语义——总数是全量匹配数，不是返回条数。

import { describe, expect, it } from 'vitest'
import type {
  DecisionRecordedPayload,
  EventActor,
  L2Event,
  SignalReceivedPayload,
} from '../../../src/shared/events.ts'
import { SIGNAL_VIEW_LIMIT } from '../../../src/shared/signals.ts'
import { project, projectSignals } from '../../../src/host/projector/project.ts'
import { querySignals } from '../../../src/host/projector/signal-query.ts'

const BASE_TIME = 1_700_000_000_000

interface EnvelopeExtra {
  time?: number
  actor?: EventActor
  correlationId?: string
}

function event<P extends object, T extends L2Event['type']>(
  seq: number,
  type: T,
  payload: P,
  extra: EnvelopeExtra = {},
): L2Event {
  return {
    seq,
    eventId: `event-${seq}`,
    type,
    time: extra.time ?? BASE_TIME + seq,
    actor: extra.actor ?? 'system',
    correlationId: extra.correlationId ?? 'correlation-1',
    payload,
  } as L2Event
}

function signalEvent(
  seq: number,
  signalId: string,
  payload: Partial<SignalReceivedPayload> = {},
): L2Event {
  return event(
    seq,
    'signal/received',
    {
      kind: 'perception',
      delivered: true,
      receivedAt: BASE_TIME + seq,
      signalId,
      text: `信号 ${signalId}`,
      ...payload,
    },
    { correlationId: signalId },
  )
}

function decisionEvent(
  seq: number,
  signalId: string,
  payload: Partial<DecisionRecordedPayload> = {},
): L2Event {
  return event(
    seq,
    'decision/recorded',
    { action: 'reply', signalId, ...payload },
    { correlationId: signalId },
  )
}

describe('projectSignals', () => {
  it('keeps the full history while the snapshot stays bounded', () => {
    const events = Array.from({ length: SIGNAL_VIEW_LIMIT + 10 }, (_, index) =>
      signalEvent(index + 1, `s-${String(index).padStart(10, '0')}`, {
        receivedAt: BASE_TIME + index,
      }),
    )

    expect(projectSignals(events)).toHaveLength(SIGNAL_VIEW_LIMIT + 10)
    expect(project(events).signals).toHaveLength(SIGNAL_VIEW_LIMIT)
  })

  it('merges one decision into its own signal', () => {
    const views = projectSignals([
      signalEvent(1, 's-aaaaaaaaaa'),
      decisionEvent(2, 's-aaaaaaaaaa', { action: 'dispatch', ticketId: 't-abcdef1234' }),
    ])

    expect(views).toHaveLength(1)
    expect(views[0]?.decision).toEqual({
      action: 'dispatch',
      ticketId: 't-abcdef1234',
      at: BASE_TIME + 2,
    })
  })

  it('orders newest first and breaks ties by signal id descending', () => {
    const views = projectSignals([
      signalEvent(1, 's-bbbbbbbbbb', { receivedAt: BASE_TIME + 100 }),
      signalEvent(2, 's-aaaaaaaaaa', { receivedAt: BASE_TIME + 100 }),
      signalEvent(3, 's-cccccccccc', { receivedAt: BASE_TIME + 50 }),
    ])

    expect(views.map(view => view.signalId)).toEqual(['s-bbbbbbbbbb', 's-aaaaaaaaaa', 's-cccccccccc'])
  })

  it('folds a decision that arrives before its signal in the input order', () => {
    const views = projectSignals([
      decisionEvent(2, 's-aaaaaaaaaa', { action: 'append', ticketId: 't-1' }),
      signalEvent(1, 's-aaaaaaaaaa'),
    ])

    expect(views[0]?.decision?.action).toBe('append')
    expect(views[0]?.decision?.ticketId).toBe('t-1')
  })
})

describe('querySignals', () => {
  const views = projectSignals([
    signalEvent(1, 's-aaaaaaaaaa', {
      sourceName: '配置文件',
      threadName: '变更',
      text: 'app.yml 被修改',
      receivedAt: BASE_TIME + 300,
    }),
    signalEvent(2, 's-bbbbbbbbbb', {
      sourceName: '工单感知',
      threadName: 'tickets',
      text: '工单 t-1 已结束',
      receivedAt: BASE_TIME + 200,
    }),
    signalEvent(3, 's-cccccccccc', {
      sourceName: '配置文件',
      threadName: '删除',
      text: 'old.yml 被删除',
      receivedAt: BASE_TIME + 100,
    }),
  ])

  it('returns everything newest first when the query is blank', () => {
    const result = querySignals(views, {})

    expect(result.total).toBe(3)
    expect(result.signals.map(view => view.signalId)).toEqual([
      's-aaaaaaaaaa',
      's-bbbbbbbbbb',
      's-cccccccccc',
    ])
  })

  it('matches the fact text case-insensitively', () => {
    const result = querySignals(views, { q: 'APP.YML' })

    expect(result.total).toBe(1)
    expect(result.signals[0]?.signalId).toBe('s-aaaaaaaaaa')
  })

  it('matches the source and thread names', () => {
    expect(querySignals(views, { q: '配置文件' }).total).toBe(2)
    expect(querySignals(views, { q: 'tickets' }).total).toBe(1)
  })

  it('requires every whitespace token to match', () => {
    expect(querySignals(views, { q: '配置文件 修改' }).total).toBe(1)
    expect(querySignals(views, { q: '配置文件 删除' }).total).toBe(1)
    expect(querySignals(views, { q: '配置文件 工单' }).total).toBe(0)
  })

  it('truncates the list but reports the full match count', () => {
    const result = querySignals(views, { q: '配置文件', limit: 1 })

    expect(result.total).toBe(2)
    expect(result.signals).toHaveLength(1)
    expect(result.signals[0]?.signalId).toBe('s-aaaaaaaaaa')
  })

  it('keeps at least one row when the limit is below the contract minimum', () => {
    const result = querySignals(views, { limit: 0 })

    expect(result.signals).toHaveLength(1)
    expect(result.total).toBe(3)
  })

  it('applies the default limit when the query omits one', () => {
    const many = projectSignals(
      Array.from({ length: 260 }, (_, index) =>
        signalEvent(index + 1, `s-${String(index).padStart(10, '0')}`),
      ),
    )

    const result = querySignals(many, {})
    expect(result.total).toBe(260)
    expect(result.signals).toHaveLength(200)
  })

  it('returns an empty result for a query that cannot match', () => {
    expect(querySignals(views, { q: '不存在的词' })).toEqual({ signals: [], total: 0 })
  })
})
