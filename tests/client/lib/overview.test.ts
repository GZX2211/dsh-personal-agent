// tests/client/lib/overview.test.ts
//
// 概览的派生逻辑全部是纯函数：输入快照与 now，输出界面直接消费的视图。
// 断言落在业务口径上（阈值、排序、降级），不测组件与文案。

import { describe, expect, it } from 'vitest'
import type { SnapshotStats, SnapshotResponse, TicketStats } from '../../../src/shared/api.ts'
import type { ApprovalView } from '../../../src/shared/approvals.ts'
import type { WorkerRuntimeView } from '../../../src/shared/runtime.ts'
import type { SourceView, TimerSourceView } from '../../../src/shared/sources.ts'
import type { TicketView } from '../../../src/shared/tickets.ts'
import {
  attentionOf,
  contextMeterOf,
  contextPercent,
  fleetOf,
  footerOf,
  isFreshEmpty,
  pulseOf,
  todayOf,
} from '../../../src/client/lib/overview.ts'

const NOW = new Date(2026, 10, 21, 12, 0, 0).getTime()
const TODAY_START = new Date(2026, 10, 21, 0, 0, 0).getTime()
const MINUTE = 60_000

function statsOf(overrides: {
  tickets?: Partial<TicketStats>
  approvals?: Partial<SnapshotStats['approvals']>
  signals?: Partial<SnapshotStats['signals']>
} = {}): SnapshotStats {
  return {
    tickets: { queued: 0, running: 0, blocked: 0, ended: 0, total: 0, ...overrides.tickets },
    approvals: { pending: 0, decided: 0, ...overrides.approvals },
    signals: { delivered: 0, filtered: 0, total: 0, ...overrides.signals },
  }
}

function ticketOf(overrides: Partial<TicketView> = {}): TicketView {
  return {
    id: 't-aaa1112223',
    shortId: 'aaa111',
    title: '修复登录超时',
    stage: 'running',
    goal: '把登录修好',
    workerSessionId: 'session-1',
    createdAt: NOW - 10 * MINUTE,
    dispatchedAt: NOW - 5 * MINUTE,
    updatedAt: NOW - MINUTE,
    ...overrides,
  }
}

function approvalOf(overrides: Partial<ApprovalView> = {}): ApprovalView {
  return {
    id: 'a-1',
    ticketId: 't-aaa1112223',
    question: '发布到生产会立刻影响用户。',
    options: [{ label: '发布', description: '立刻上线' }],
    requestedBySessionId: 'session-1',
    createdAt: NOW - 6 * MINUTE,
    ...overrides,
  }
}

function workerOf(overrides: Partial<WorkerRuntimeView> = {}): WorkerRuntimeView {
  return {
    ticketId: 't-aaa1112223',
    workerSessionId: 'session-1',
    live: 'running',
    turn: 3,
    lastActivityAt: NOW - 30_000,
    ...overrides,
  }
}

function sourceOf(overrides: Partial<SourceView> = {}): SourceView {
  return {
    id: 'src-1',
    name: '线上日志',
    enabled: true,
    channelKind: 'fs-watch',
    config: { kind: 'fs-watch', paths: ['D:/tmp/a.txt'], recursive: false },
    status: 'running',
    threads: [],
    deliveredCount: 0,
    filteredCount: 0,
    ...overrides,
  }
}

function timerOf(overrides: Partial<TimerSourceView> = {}): TimerSourceView {
  return {
    scheduleId: 'schedule-1',
    title: '每日汇总',
    active: true,
    timing: { kind: 'daily', time: '09:00', timeZone: 'Asia/Shanghai' },
    deliveredCount: 0,
    ...overrides,
  }
}

function snapshotOf(overrides: Partial<SnapshotResponse> = {}): SnapshotResponse {
  return {
    tickets: [],
    approvals: [],
    signals: [],
    sources: [],
    timers: [],
    stats: statsOf(),
    ...overrides,
  }
}

describe('contextMeterOf', () => {
  it('treats a 1M window as an effective 800K window', () => {
    const meter = contextMeterOf({ usedTokens: 480_000, windowTokens: 1_000_000 })

    expect(meter).toEqual({
      usedTokens: 480_000,
      windowTokens: 1_000_000,
      effectiveWindow: 800_000,
      ratio: 0.6,
      level: 'warn',
    })
    expect(contextPercent(meter?.ratio ?? 0)).toBe(60)
  })

  it('keeps 59.9% normal and floors the displayed percentage', () => {
    const meter = contextMeterOf({ usedTokens: 479_000, windowTokens: 1_000_000 })

    expect(meter?.level).toBe('normal')
    expect(contextPercent(meter?.ratio ?? 0)).toBe(59)
  })

  it('keeps 79.9% warn with a displayed 79%', () => {
    const meter = contextMeterOf({ usedTokens: 639_000, windowTokens: 1_000_000 })

    expect(meter?.level).toBe('warn')
    expect(contextPercent(meter?.ratio ?? 0)).toBe(79)
  })

  it('marks exactly 80% critical', () => {
    const meter = contextMeterOf({ usedTokens: 640_000, windowTokens: 1_000_000 })

    expect(meter?.level).toBe('critical')
    expect(contextPercent(meter?.ratio ?? 0)).toBe(80)
  })

  it('keeps the real percentage above 100%', () => {
    const full = contextMeterOf({ usedTokens: 800_000, windowTokens: 1_000_000 })
    const over = contextMeterOf({ usedTokens: 880_000, windowTokens: 1_000_000 })

    expect(contextPercent(full?.ratio ?? 0)).toBe(100)
    expect(contextPercent(over?.ratio ?? 0)).toBe(110)
    expect(over?.level).toBe('critical')
  })

  it('degrades to token-only when the route reports no window', () => {
    expect(contextMeterOf({ usedTokens: 168_000 })).toEqual({ usedTokens: 168_000, level: 'unknown' })
  })

  it('treats invalid windows as unreported', () => {
    for (const windowTokens of [0, -1, Number.POSITIVE_INFINITY, Number.NaN]) {
      expect(contextMeterOf({ usedTokens: 1_000, windowTokens })).toEqual({
        usedTokens: 1_000,
        level: 'unknown',
      })
    }
  })

  it('returns nothing when no request has been made', () => {
    expect(contextMeterOf(undefined)).toBeUndefined()
  })
})

describe('pulseOf', () => {
  it('reports no-router when the router session is missing', () => {
    const pulse = pulseOf(snapshotOf({ tickets: [ticketOf()], stats: statsOf({ tickets: { running: 1 } }) }))

    expect(pulse.state).toBe('no-router')
    expect(pulse.clickable).toBe(false)
  })

  it('reports running while any ticket occupies a slot', () => {
    const pulse = pulseOf(
      snapshotOf({
        routerSessionId: 'router-1',
        tickets: [ticketOf()],
        stats: statsOf({ tickets: { blocked: 1 } }),
      }),
    )

    expect(pulse).toEqual(expect.objectContaining({ state: 'running', clickable: true }))
  })

  it('reports sensing while a source runs', () => {
    const pulse = pulseOf(snapshotOf({ routerSessionId: 'router-1', sources: [sourceOf()] }))

    expect(pulse.state).toBe('sensing')
  })

  it('reports idle when nothing is running', () => {
    const pulse = pulseOf(snapshotOf({ routerSessionId: 'router-1', sources: [sourceOf({ status: 'stopped' })] }))

    expect(pulse.state).toBe('idle')
  })

  it('takes the newest activity across signals, tickets, approvals and workers', () => {
    const pulse = pulseOf(
      snapshotOf({
        routerSessionId: 'router-1',
        tickets: [ticketOf({ updatedAt: NOW - 200_000 })],
        approvals: [approvalOf({ createdAt: NOW - 300_000, decidedAt: NOW - 150_000 })],
        signals: [{ signalId: 's-1', kind: 'user-message', receivedAt: NOW - 400_000, delivered: true, text: '你好' }],
        workers: [workerOf({ lastActivityAt: NOW - 10_000 })],
      }),
    )

    expect(pulse.lastActivityAt).toBe(NOW - 10_000)
  })
})

describe('attentionOf', () => {
  it('summarizes pending approvals with wait, risk and held slots', () => {
    const snapshot = snapshotOf({
      approvals: [
        approvalOf({ id: 'a-old', createdAt: NOW - 12 * MINUTE, risk: 'medium' }),
        approvalOf({ id: 'a-high', createdAt: NOW - 6 * MINUTE, risk: 'high' }),
      ],
      tickets: [ticketOf({ stage: 'blocked' })],
      stats: statsOf({ tickets: { blocked: 1 }, approvals: { pending: 2 } }),
    })

    expect(attentionOf(snapshot, NOW)).toEqual([
      {
        id: 'approval',
        kind: 'approval',
        severity: 'warning',
        count: 2,
        target: { kind: 'tab', tab: 'approvals' },
        oldestAt: NOW - 12 * MINUTE,
        risk: 'high',
        blockedCount: 1,
      },
    ])
  })

  it('counts failing sources once with their total', () => {
    const snapshot = snapshotOf({
      sources: [sourceOf({ id: 'src-1', status: 'error' }), sourceOf({ id: 'src-2', status: 'error' })],
    })

    expect(attentionOf(snapshot, NOW)).toEqual([
      {
        id: 'source-error',
        kind: 'source-error',
        severity: 'warning',
        count: 2,
        target: { kind: 'tab', tab: 'sources' },
      },
    ])
  })

  it('counts offline workers once, including tickets with no runtime entry', () => {
    const snapshot = snapshotOf({
      tickets: [ticketOf({ id: 't-offline0001' }), ticketOf({ id: 't-missing0001', workerSessionId: 'session-2' })],
      workers: [workerOf({ ticketId: 't-offline0001', live: 'offline' })],
      stats: statsOf({ tickets: { running: 2 } }),
    })

    expect(attentionOf(snapshot, NOW)).toEqual([
      {
        id: 'worker-offline',
        kind: 'worker-offline',
        severity: 'danger',
        count: 2,
        target: { kind: 'tab', tab: 'tickets' },
      },
    ])
  })

  it('excludes an interrupted ticket whose session is offline', () => {
    const snapshot = snapshotOf({
      tickets: [ticketOf({ interrupted: true })],
      workers: [workerOf({ live: 'offline' })],
      stats: statsOf({ tickets: { running: 1 } }),
    })

    expect(attentionOf(snapshot, NOW).map(item => item.kind)).toEqual(['worker-offline'])
  })

  it('links a single critical context to its worker session', () => {
    const snapshot = snapshotOf({
      tickets: [ticketOf()],
      workers: [workerOf({ context: { usedTokens: 640_000, windowTokens: 1_000_000 } })],
      stats: statsOf({ tickets: { running: 1 } }),
    })

    expect(attentionOf(snapshot, NOW)).toEqual([
      {
        id: 'context-critical',
        kind: 'context-critical',
        severity: 'danger',
        count: 1,
        target: { kind: 'session', sessionId: 'session-1' },
      },
    ])
  })

  it('links multiple critical contexts to the ticket page', () => {
    const snapshot = snapshotOf({
      tickets: [ticketOf({ id: 't-aaa1112223' }), ticketOf({ id: 't-bbb2223334', workerSessionId: 'session-2' })],
      workers: [
        workerOf({ context: { usedTokens: 640_000, windowTokens: 1_000_000 } }),
        workerOf({
          ticketId: 't-bbb2223334',
          workerSessionId: 'session-2',
          context: { usedTokens: 900_000, windowTokens: 1_000_000 },
        }),
      ],
      stats: statsOf({ tickets: { running: 2 } }),
    })

    expect(attentionOf(snapshot, NOW)).toEqual([
      {
        id: 'context-critical',
        kind: 'context-critical',
        severity: 'danger',
        count: 2,
        target: { kind: 'tab', tab: 'tickets' },
      },
    ])
  })

  it('orders approval, offline, source, interrupted and context', () => {
    const snapshot = snapshotOf({
      routerSessionId: 'router-1',
      approvals: [approvalOf()],
      sources: [sourceOf({ id: 'src-1', status: 'error' })],
      tickets: [
        ticketOf({ id: 't-aaa1112223' }),
        ticketOf({ id: 't-bbb2223334', workerSessionId: 'session-2', interrupted: true }),
        ticketOf({ id: 't-ccc3334445', workerSessionId: 'session-3' }),
      ],
      workers: [
        workerOf({ ticketId: 't-aaa1112223', context: { usedTokens: 640_000, windowTokens: 1_000_000 } }),
        workerOf({ ticketId: 't-bbb2223334', workerSessionId: 'session-2' }),
        workerOf({ ticketId: 't-ccc3334445', workerSessionId: 'session-3', live: 'offline' }),
      ],
      stats: statsOf({ tickets: { running: 3 }, approvals: { pending: 1 } }),
    })

    expect(attentionOf(snapshot, NOW).map(item => item.kind)).toEqual([
      'approval',
      'worker-offline',
      'source-error',
      'worker-interrupted',
      'context-critical',
    ])
  })

  it('reports nothing for a quiet snapshot', () => {
    expect(attentionOf(snapshotOf({ routerSessionId: 'router-1' }), NOW)).toEqual([])
  })
})

describe('fleetOf', () => {
  it('orders waiting, running, starting, interrupted, offline and idle', () => {
    const snapshot = snapshotOf({
      tickets: [
        ticketOf({ id: 't-idle000001', shortId: 'idle00', workerSessionId: 's-idle' }),
        ticketOf({ id: 't-wait000001', shortId: 'wait00', stage: 'blocked', workerSessionId: 's-wait' }),
        ticketOf({ id: 't-run0000001', shortId: 'run000', workerSessionId: 's-run' }),
        ticketOf({ id: 't-start00001', shortId: 'start0', workerSessionId: 's-start' }),
        ticketOf({ id: 't-int0000001', shortId: 'int000', interrupted: true, workerSessionId: 's-int' }),
        ticketOf({ id: 't-off0000001', shortId: 'off000', workerSessionId: 's-off' }),
      ],
      workers: [
        workerOf({ ticketId: 't-idle000001', workerSessionId: 's-idle', live: 'idle', turn: 2, lastActivityAt: NOW - 1_000 }),
        workerOf({ ticketId: 't-wait000001', workerSessionId: 's-wait', live: 'idle', turn: 2 }),
        workerOf({ ticketId: 't-run0000001', workerSessionId: 's-run', live: 'running', turn: 2 }),
        workerOf({ ticketId: 't-start00001', workerSessionId: 's-start', live: 'running', turn: 0 }),
        workerOf({ ticketId: 't-int0000001', workerSessionId: 's-int', live: 'running', turn: 2 }),
        workerOf({ ticketId: 't-off0000001', workerSessionId: 's-off', live: 'offline', turn: 2 }),
      ],
      stats: statsOf({ tickets: { running: 5, blocked: 1 } }),
    })

    expect(fleetOf(snapshot, NOW).rows.map(row => row.status)).toEqual([
      'waiting',
      'running',
      'starting',
      'interrupted',
      'offline',
      'idle',
    ])
  })

  it('degrades every dispatched ticket to unknown when the snapshot has no workers', () => {
    const snapshot = snapshotOf({
      tickets: [ticketOf(), ticketOf({ id: 't-queued0001', stage: 'queued', workerSessionId: undefined })],
      stats: statsOf({ tickets: { running: 1, queued: 1 } }),
    })

    const fleet = fleetOf(snapshot, NOW)

    expect(fleet.rows).toHaveLength(1)
    expect(fleet.rows[0]).toEqual(
      expect.objectContaining({ status: 'unknown', offline: false, turn: 0 }),
    )
    expect(fleet.rows[0]?.context).toBeUndefined()
    expect(fleet.maxWorkers).toBe(5)
    expect(fleet.queued).toBe(1)
  })

  it('treats a missing runtime entry as an offline worker', () => {
    const snapshot = snapshotOf({
      tickets: [ticketOf()],
      workers: [],
      stats: statsOf({ tickets: { running: 1 } }),
    })

    expect(fleetOf(snapshot, NOW).rows[0]).toEqual(
      expect.objectContaining({ status: 'offline', offline: true }),
    )
    expect(fleetOf(snapshot, NOW).rows[0]?.context).toBeUndefined()
  })

  it('excludes a queued append ticket that already carries a session', () => {
    const snapshot = snapshotOf({
      tickets: [ticketOf({ stage: 'queued', workerSessionId: 'session-reused' })],
      workers: [],
      stats: statsOf({ tickets: { queued: 1 } }),
    })

    expect(fleetOf(snapshot, NOW).rows).toEqual([])
  })

  it('measures elapsed time from dispatch and waiting from the oldest approval', () => {
    const snapshot = snapshotOf({
      tickets: [ticketOf({ stage: 'blocked', createdAt: NOW - 60 * MINUTE, dispatchedAt: NOW - 5 * MINUTE })],
      approvals: [
        approvalOf({ id: 'a-new', createdAt: NOW - 2 * MINUTE }),
        approvalOf({ id: 'a-old', createdAt: NOW - 4 * MINUTE }),
      ],
      workers: [workerOf({ live: 'idle', turn: 1 })],
      stats: statsOf({ tickets: { blocked: 1 }, approvals: { pending: 2 } }),
    })

    const row = fleetOf(snapshot, NOW).rows[0]

    expect(row?.elapsedMs).toBe(5 * MINUTE)
    expect(row?.waitingMs).toBe(4 * MINUTE)
  })

  it('keeps the context meter off offline and unknown rows', () => {
    const snapshot = snapshotOf({
      tickets: [ticketOf()],
      workers: [workerOf({ live: 'offline', context: { usedTokens: 640_000, windowTokens: 1_000_000 } })],
      stats: statsOf({ tickets: { running: 1 } }),
    })

    expect(fleetOf(snapshot, NOW).rows[0]?.context).toBeUndefined()
  })

  it('uses the snapshot capacity and occupied slot count', () => {
    const snapshot = snapshotOf({
      capacity: { maxWorkers: 9 },
      stats: statsOf({ tickets: { running: 2, blocked: 1, queued: 3 } }),
    })

    expect(fleetOf(snapshot, NOW)).toEqual(expect.objectContaining({ occupied: 3, maxWorkers: 9, queued: 3 }))
  })
})

describe('todayOf', () => {
  it('filters approvals and tickets by the Host-provided local day start', () => {
    const snapshot = snapshotOf({
      activity: {
        today: { start: TODAY_START, delivered: 11, filtered: 7 },
        days: [],
      },
      approvals: [
        approvalOf({ id: 'a-today', decidedAt: TODAY_START }),
        approvalOf({ id: 'a-yesterday', decidedAt: TODAY_START - 1 }),
        approvalOf({ id: 'a-pending' }),
      ],
      tickets: [
        ticketOf({ id: 't-done', endedAt: TODAY_START, outcome: 'completed', createdAt: TODAY_START - 10 * MINUTE }),
        ticketOf({ id: 't-failed', endedAt: TODAY_START + 4 * MINUTE, outcome: 'failed', createdAt: TODAY_START - 4 * MINUTE }),
        ticketOf({ id: 't-old', endedAt: TODAY_START - 1, outcome: 'completed' }),
      ],
      stats: statsOf({ approvals: { pending: 1, decided: 2 } }),
    })

    expect(todayOf(snapshot, NOW)).toEqual({
      start: TODAY_START,
      approvalsDecided: 1,
      approvalsPending: 1,
      ticketsCompleted: 1,
      ticketsFailed: 1,
      averageTicketMs: 9 * MINUTE,
      signals: { delivered: 11, filtered: 7, total: 18 },
    })
  })

  it('falls back to local midnight and hides signals without activity', () => {
    const today = todayOf(snapshotOf(), NOW)

    expect(today.start).toBe(TODAY_START)
    expect(today.signals).toBeUndefined()
  })
})

describe('footerOf', () => {
  it('sums totals, running/error sources and active timers', () => {
    const snapshot = snapshotOf({
      stats: statsOf({
        tickets: { total: 24 },
        approvals: { pending: 2, decided: 7 },
        signals: { total: 1_284 },
      }),
      sources: [sourceOf({ id: 'src-1' }), sourceOf({ id: 'src-2', status: 'error' })],
      timers: [timerOf(), timerOf({ scheduleId: 'schedule-2', active: false })],
    })

    expect(footerOf(snapshot)).toEqual({
      tickets: 24,
      approvals: 9,
      signals: 1_284,
      sourcesRunning: 1,
      sourcesError: 1,
      timers: 1,
    })
  })
})

describe('isFreshEmpty', () => {
  it('is true only for a snapshot with no facts at all', () => {
    expect(isFreshEmpty(snapshotOf())).toBe(true)
    expect(isFreshEmpty(snapshotOf({ signals: [{ signalId: 's-1', kind: 'user-message', receivedAt: NOW, delivered: true, text: '你好' }] }))).toBe(false)
    expect(isFreshEmpty(snapshotOf({ timers: [timerOf()] }))).toBe(false)
  })
})
