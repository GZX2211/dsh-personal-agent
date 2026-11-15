// tests/host/projector/project.test.ts
//
// 投影是纯函数：输入全部事件，输出工单与审批视图。断言一律落在「业务上能看到的
// 结果」（阶段、字段、顺序、计数），不断言内部累加结构。

import { describe, expect, it } from 'vitest'
import type {
  ApprovalDecidedPayload,
  ApprovalDiscardedPayload,
  ApprovalPendingPayload,
  EventActor,
  L2Event,
  TaskClosedPayload,
  TaskDispatchedPayload,
  TaskInterruptedPayload,
  TaskQueuedPayload,
  TaskReportedPayload,
  TaskResumedPayload,
} from '../../../src/shared/events.ts'
import { project } from '../../../src/host/projector/project.ts'

const BASE_TIME = 1_700_000_000_000

interface EnvelopeExtra {
  time?: number
  actor?: EventActor
  correlationId?: string
  sessionId?: string
}

/** 事件构造器只补在场事实；测试不依赖账本排号之外的技术字段。 */
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
    sessionId: extra.sessionId,
    payload,
  } as L2Event
}

function queuedEvent(
  seq: number,
  ticketId: string,
  payload: Partial<TaskQueuedPayload> = {},
  extra: EnvelopeExtra = {},
): L2Event {
  return event(
    seq,
    'task/queued',
    { ticketId, title: `任务 ${ticketId}`, goal: '把事做完', mode: 'dispatch', ...payload },
    { actor: 'router', ...extra },
  )
}

function dispatchedEvent(
  seq: number,
  ticketId: string,
  payload: Partial<TaskDispatchedPayload> = {},
  extra: EnvelopeExtra = {},
): L2Event {
  return event(
    seq,
    'task/dispatched',
    { ticketId, workerSessionId: `session-${ticketId}`, mode: 'dispatch', ...payload },
    { actor: 'system', ...extra },
  )
}

function interruptedEvent(
  seq: number,
  ticketId: string,
  payload: Partial<TaskInterruptedPayload> = {},
  extra: EnvelopeExtra = {},
): L2Event {
  return event(
    seq,
    'task/interrupted',
    { ticketId, turn: 1, reason: 'turn-aborted', ...payload },
    { actor: 'system', ...extra },
  )
}

function resumedEvent(
  seq: number,
  ticketId: string,
  payload: Partial<TaskResumedPayload> = {},
  extra: EnvelopeExtra = {},
): L2Event {
  return event(seq, 'task/resumed', { ticketId, turn: 2, ...payload }, { actor: 'system', ...extra })
}

function reportedEvent(  seq: number,
  ticketId: string,
  payload: Partial<TaskReportedPayload> = {},
  extra: EnvelopeExtra = {},
): L2Event {
  return event(
    seq,
    'task/reported',
    { ticketId, summary: '做完了', status: 'done', ...payload },
    { actor: 'worker', ...extra },
  )
}

function closedEvent(
  seq: number,
  ticketId: string,
  payload: Partial<TaskClosedPayload> = {},
  extra: EnvelopeExtra = {},
): L2Event {
  return event(
    seq,
    'task/closed',
    { ticketId, outcome: 'completed', ...payload },
    { actor: 'system', ...extra },
  )
}

function pendingEvent(
  seq: number,
  approvalId: string,
  ticketId: string,
  payload: Partial<ApprovalPendingPayload> = {},
  extra: EnvelopeExtra = {},
): L2Event {
  return event(
    seq,
    'approval/pending',
    {
      approvalId,
      ticketId,
      title: '要发布吗',
      question: '发布到生产会立刻影响用户。',
      options: [
        { label: '发布', description: '立刻上线' },
        { label: '等等', description: '继续观察' },
      ],
      requestedBySessionId: `session-${ticketId}`,
      ...payload,
    },
    { actor: 'worker', ...extra },
  )
}

function decidedEvent(
  seq: number,
  approvalId: string,
  payload: Partial<ApprovalDecidedPayload> = {},
  extra: EnvelopeExtra = {},
): L2Event {
  return event(
    seq,
    'approval/decided',
    {
      approvalId,
      decision: { kind: 'selected', index: 1, label: '等等' },
      decidedAt: BASE_TIME + seq,
      transport: 'inline',
      ...payload,
    },
    { actor: 'human', ...extra },
  )
}

function discardedEvent(
  seq: number,
  approvalId: string,
  payload: Partial<ApprovalDiscardedPayload> = {},
  extra: EnvelopeExtra = {},
): L2Event {
  return event(
    seq,
    'approval/discarded',
    { approvalId, reason: 'worker-archived', discardedAt: BASE_TIME + seq, ...payload },
    { actor: 'system', ...extra },
  )
}

describe('project', () => {
  it('returns empty views and zero stats for an empty ledger', () => {
    const projection = project([])

    expect(projection).toEqual({
      tickets: [],
      approvals: [],
      stats: {
        tickets: { queued: 0, running: 0, blocked: 0, ended: 0, total: 0 },
        approvals: { pending: 0, decided: 0 },
      },
    })
  })

  it('derives a queued ticket without a worker session', () => {
    const projection = project([
      queuedEvent(1, 't-aaa1112223', { queueReason: 'capacity-full', directory: '/state/work/t-aaa1112223' }),
    ])

    expect(projection.tickets).toEqual([
      {
        id: 't-aaa1112223',
        shortId: 'aaa111',
        title: '任务 t-aaa1112223',
        stage: 'queued',
        queueReason: 'capacity-full',
        goal: '把事做完',
        directory: '/state/work/t-aaa1112223',
        createdAt: BASE_TIME + 1,
        updatedAt: BASE_TIME + 1,
      },
    ])
  })

  it('moves a dispatched ticket to running and records its worker session', () => {
    const projection = project([
      queuedEvent(1, 't-aaa1112223', { queueReason: 'worker-busy' }),
      dispatchedEvent(2, 't-aaa1112223', { workerSessionId: 'session-worker-1' }),
    ])

    expect(projection.tickets).toEqual([
      expect.objectContaining({
        stage: 'running',
        workerSessionId: 'session-worker-1',
        createdAt: BASE_TIME + 1,
        updatedAt: BASE_TIME + 2,
      }),
    ])
    // 放行后排队原因解释不了任何现状，视图不再带它。
    expect(projection.tickets[0]).not.toHaveProperty('queueReason')
  })

  it('marks a dispatched ticket blocked while an approval is pending', () => {
    const projection = project([
      queuedEvent(1, 't-aaa1112223'),
      dispatchedEvent(2, 't-aaa1112223'),
      pendingEvent(3, 'a-1', 't-aaa1112223'),
    ])

    expect(projection.tickets).toEqual([expect.objectContaining({ stage: 'blocked' })])
    expect(projection.stats.tickets.blocked).toBe(1)
    expect(projection.stats.tickets.running).toBe(0)
  })

  it('returns the ticket to running when the pending approval is decided', () => {
    const projection = project([
      queuedEvent(1, 't-aaa1112223'),
      dispatchedEvent(2, 't-aaa1112223'),
      pendingEvent(3, 'a-1', 't-aaa1112223'),
      decidedEvent(4, 'a-1', {
        decision: { kind: 'selected', index: 1, label: '等等', note: '先别发', fields: { window: '今晚' } },
        decidedAt: BASE_TIME + 4,
        transport: 'followup',
      }),
    ])

    expect(projection.tickets).toEqual([expect.objectContaining({ stage: 'running' })])
    expect(projection.approvals).toEqual([
      expect.objectContaining({
        id: 'a-1',
        decidedAt: BASE_TIME + 4,
        decision: { kind: 'selected', index: 1, label: '等等', note: '先别发', fields: { window: '今晚' }, transport: 'followup' },
      }),
    ])
    expect(projection.stats.approvals).toEqual({ pending: 0, decided: 1 })
  })

  it('releases a ticket when its pending approval is discarded and hides the discarded entry', () => {
    const projection = project([
      queuedEvent(1, 't-aaa1112223'),
      dispatchedEvent(2, 't-aaa1112223'),
      pendingEvent(3, 'a-1', 't-aaa1112223'),
      discardedEvent(4, 'a-1'),
    ])

    expect(projection.tickets).toEqual([expect.objectContaining({ stage: 'running' })])
    expect(projection.approvals).toEqual([])
    expect(projection.stats.approvals).toEqual({ pending: 0, decided: 0 })
  })

  it('ends a ticket with its outcome and report', () => {
    const projection = project([
      queuedEvent(1, 't-aaa1112223'),
      dispatchedEvent(2, 't-aaa1112223'),
      reportedEvent(3, 't-aaa1112223', { summary: '发布完成', status: 'done' }),
      closedEvent(4, 't-aaa1112223', { outcome: 'completed' }),
    ])

    expect(projection.tickets).toEqual([
      expect.objectContaining({
        stage: 'ended',
        outcome: 'completed',
        report: '发布完成',
        endedAt: BASE_TIME + 4,
      }),
    ])
    expect(projection.stats.tickets).toEqual({ queued: 0, running: 0, blocked: 0, ended: 1, total: 1 })
  })

  it('keeps ended as the terminal stage even when an approval is still pending', () => {
    const projection = project([
      queuedEvent(1, 't-aaa1112223'),
      dispatchedEvent(2, 't-aaa1112223'),
      pendingEvent(3, 'a-1', 't-aaa1112223'),
      closedEvent(4, 't-aaa1112223', { outcome: 'failed', reason: 'turn-error' }),
    ])

    expect(projection.tickets).toEqual([expect.objectContaining({ stage: 'ended', outcome: 'failed' })])
    expect(projection.approvals).toEqual([expect.objectContaining({ id: 'a-1' })])
  })

  it('keeps blocked only for dispatched tickets', () => {
    // 缺 dispatched 的 pending 是账本不完整，不是「阻塞中」：不替数据编造阶段。
    const projection = project([
      queuedEvent(1, 't-aaa1112223'),
      pendingEvent(2, 'a-1', 't-aaa1112223'),
    ])

    expect(projection.tickets).toEqual([expect.objectContaining({ stage: 'queued' })])
    expect(projection.approvals).toEqual([expect.objectContaining({ id: 'a-1' })])
  })

  it('ignores ticket events whose creation event is missing', () => {
    const projection = project([
      dispatchedEvent(1, 't-ghost0000'),
      reportedEvent(2, 't-ghost0000'),
      closedEvent(3, 't-ghost0000'),
    ])

    expect(projection.tickets).toEqual([])
    expect(projection.stats.tickets.total).toBe(0)
  })

  it('ignores approval decisions for approvals that were never requested', () => {
    const projection = project([
      decidedEvent(1, 'a-ghost'),
      discardedEvent(2, 'a-ghost'),
    ])

    expect(projection.approvals).toEqual([])
    expect(projection.stats.approvals).toEqual({ pending: 0, decided: 0 })
  })

  it('sorts events by seq before deriving stages', () => {
    const shuffled = [
      pendingEvent(3, 'a-1', 't-aaa1112223'),
      dispatchedEvent(2, 't-aaa1112223'),
      queuedEvent(1, 't-aaa1112223'),
    ]

    expect(project(shuffled).tickets).toEqual([expect.objectContaining({ stage: 'blocked' })])
  })

  it('keeps the last report as the ticket summary', () => {
    const projection = project([
      queuedEvent(1, 't-aaa1112223'),
      dispatchedEvent(2, 't-aaa1112223'),
      reportedEvent(3, 't-aaa1112223', { summary: '第一版' }),
      reportedEvent(4, 't-aaa1112223', { summary: '第二版' }),
    ])

    expect(projection.tickets).toEqual([
      expect.objectContaining({ report: '第二版', updatedAt: BASE_TIME + 4 }),
    ])
  })

  it('does not let clock skew move updatedAt backwards', () => {
    const projection = project([
      queuedEvent(1, 't-aaa1112223', {}, { time: BASE_TIME + 5_000 }),
      dispatchedEvent(2, 't-aaa1112223', {}, { time: BASE_TIME + 1_000 }),
    ])

    expect(projection.tickets).toEqual([
      expect.objectContaining({ createdAt: BASE_TIME + 5_000, updatedAt: BASE_TIME + 5_000 }),
    ])
  })

  it('derives independent tickets from interleaved events and orders them by creation time', () => {
    const projection = project([
      queuedEvent(1, 't-bbb2223334', {}, { time: BASE_TIME + 200 }),
      queuedEvent(2, 't-aaa1112223', {}, { time: BASE_TIME + 100 }),
      dispatchedEvent(3, 't-bbb2223334'),
      reportedEvent(4, 't-bbb2223334', { summary: 'B 的汇报' }),
      dispatchedEvent(5, 't-aaa1112223'),
      closedEvent(6, 't-bbb2223334', { outcome: 'completed' }),
    ])

    expect(projection.tickets.map(ticket => ticket.id)).toEqual(['t-aaa1112223', 't-bbb2223334'])
    expect(projection.tickets.map(ticket => ticket.stage)).toEqual(['running', 'ended'])
    expect(projection.tickets[1]?.report).toBe('B 的汇报')
  })

  it('orders approvals pending by creation and decided by decision time, newest first', () => {
    const projection = project([
      queuedEvent(1, 't-aaa1112223'),
      dispatchedEvent(2, 't-aaa1112223'),
      // 审批必须先提交后决定；这里对比的是两种状态各自的排序规则。
      pendingEvent(3, 'a-done-early', 't-aaa1112223', {}, { time: BASE_TIME + 50 }),
      pendingEvent(4, 'a-done-late', 't-aaa1112223', {}, { time: BASE_TIME + 60 }),
      pendingEvent(5, 'a-late', 't-aaa1112223', {}, { time: BASE_TIME + 300 }),
      pendingEvent(6, 'a-early', 't-aaa1112223', {}, { time: BASE_TIME + 100 }),
      decidedEvent(7, 'a-done-early', { decidedAt: BASE_TIME + 500 }),
      decidedEvent(8, 'a-done-late', { decidedAt: BASE_TIME + 900 }),
    ])

    expect(projection.approvals.map(approval => approval.id)).toEqual([
      'a-early',
      'a-late',
      'a-done-late',
      'a-done-early',
    ])
  })

  it('counts every stage and approval state in stats', () => {
    const projection = project([
      queuedEvent(1, 't-queued0001'),
      queuedEvent(2, 't-running001'),
      dispatchedEvent(3, 't-running001'),
      queuedEvent(4, 't-blocked001'),
      dispatchedEvent(5, 't-blocked001'),
      pendingEvent(6, 'a-open', 't-blocked001'),
      queuedEvent(7, 't-ended00001'),
      dispatchedEvent(8, 't-ended00001'),
      closedEvent(9, 't-ended00001'),
      pendingEvent(10, 'a-closed', 't-ended00001'),
      decidedEvent(11, 'a-closed'),
    ])

    expect(projection.stats).toEqual({
      tickets: { queued: 1, running: 1, blocked: 1, ended: 1, total: 4 },
      approvals: { pending: 1, decided: 1 },
    })
  })

  it('does not project from signal or decision events', () => {
    const projection = project([
      event(1, 'signal/received', { kind: 'user-message', delivered: true, receivedAt: BASE_TIME }),
      event(2, 'decision/recorded', { action: 'reply', inferred: true }),
    ])

    expect(projection.tickets).toEqual([])
    expect(projection.approvals).toEqual([])
    expect(projection.stats).toEqual({
      tickets: { queued: 0, running: 0, blocked: 0, ended: 0, total: 0 },
      approvals: { pending: 0, decided: 0 },
    })
  })

  it('derives the same stage for an appended ticket', () => {
    const projection = project([
      queuedEvent(1, 't-ccc3334445', { mode: 'append', workerSessionId: 'session-reused', queueReason: 'worker-busy' }),
      dispatchedEvent(2, 't-ccc3334445', { mode: 'append', workerSessionId: 'session-reused' }),
    ])

    expect(projection.tickets).toEqual([
      expect.objectContaining({
        stage: 'running',
        workerSessionId: 'session-reused',
        goal: '把事做完',
      }),
    ])
  })

  it('does not downgrade a dispatched ticket when a queued event arrives later', () => {
    const projection = project([
      queuedEvent(1, 't-aaa1112223'),
      dispatchedEvent(2, 't-aaa1112223'),
      queuedEvent(3, 't-aaa1112223', { title: '迟到的重复入队', queueReason: 'capacity-full' }),
    ])

    expect(projection.tickets).toEqual([
      expect.objectContaining({ stage: 'running', title: '任务 t-aaa1112223', updatedAt: BASE_TIME + 3 }),
    ])
    expect(projection.tickets[0]).not.toHaveProperty('queueReason')
  })

  it('keeps a reported failure running until the ticket is closed', () => {
    const projection = project([
      queuedEvent(1, 't-aaa1112223'),
      dispatchedEvent(2, 't-aaa1112223'),
      reportedEvent(3, 't-aaa1112223', { summary: '失败了', status: 'failed' }),
    ])

    // 汇报只是事实，"结束"必须由 task/closed 表达（附录 A 决策 2）。
    expect(projection.tickets).toEqual([expect.objectContaining({ stage: 'running', report: '失败了' })])
  })

  it('ends a failed ticket without inventing a report', () => {
    const projection = project([
      queuedEvent(1, 't-aaa1112223'),
      dispatchedEvent(2, 't-aaa1112223'),
      closedEvent(3, 't-aaa1112223', { outcome: 'failed', reason: 'turn-error' }),
    ])

    expect(projection.tickets).toEqual([
      expect.objectContaining({ stage: 'ended', outcome: 'failed', endedAt: BASE_TIME + 3 }),
    ])
    expect(projection.tickets[0]).not.toHaveProperty('report')
  })

  it('carries approval fields, risk and requester into the view', () => {
    const projection = project([
      queuedEvent(1, 't-aaa1112223'),
      dispatchedEvent(2, 't-aaa1112223'),
      pendingEvent(
        3,
        'a-1',
        't-aaa1112223',
        {
          risk: 'high',
          fields: [{ key: 'window', label: '发布时间', type: 'text', required: true }],
        },
      ),
    ])

    expect(projection.approvals).toEqual([
      {
        id: 'a-1',
        ticketId: 't-aaa1112223',
        title: '要发布吗',
        question: '发布到生产会立刻影响用户。',
        options: [
          { label: '发布', description: '立刻上线' },
          { label: '等等', description: '继续观察' },
        ],
        fields: [{ key: 'window', label: '发布时间', type: 'text', required: true }],
        risk: 'high',
        requestedBySessionId: 'session-t-aaa1112223',
        createdAt: BASE_TIME + 3,
      },
    ])
  })

  it('records a skipped decision without an option index', () => {
    const projection = project([
      queuedEvent(1, 't-aaa1112223'),
      dispatchedEvent(2, 't-aaa1112223'),
      pendingEvent(3, 'a-1', 't-aaa1112223'),
      decidedEvent(4, 'a-1', { decision: { kind: 'skipped', note: '你自己看着办' } }),
    ])

    expect(projection.approvals).toEqual([
      expect.objectContaining({
        decidedAt: BASE_TIME + 4,
        decision: { kind: 'skipped', note: '你自己看着办', transport: 'inline' },
      }),
    ])
    expect(projection.stats.approvals).toEqual({ pending: 0, decided: 1 })
  })

  it('marks a running ticket interrupted after an aborted turn', () => {
    const projection = project([
      queuedEvent(1, 't-aaa1112223'),
      dispatchedEvent(2, 't-aaa1112223'),
      interruptedEvent(3, 't-aaa1112223', { turn: 2 }),
    ])

    expect(projection.tickets).toEqual([expect.objectContaining({ stage: 'running', interrupted: true })])
    expect(projection.stats.tickets.running).toBe(1)
  })

  it('clears the interrupted mark when the worker resumes', () => {
    const projection = project([
      queuedEvent(1, 't-aaa1112223'),
      dispatchedEvent(2, 't-aaa1112223'),
      interruptedEvent(3, 't-aaa1112223'),
      resumedEvent(4, 't-aaa1112223', { turn: 3 }),
    ])

    expect(projection.tickets).toEqual([expect.objectContaining({ stage: 'running' })])
    expect(projection.tickets[0]).not.toHaveProperty('interrupted')
  })

  it('clears the interrupted mark when the ticket is dispatched again', () => {
    const projection = project([
      queuedEvent(1, 't-aaa1112223'),
      dispatchedEvent(2, 't-aaa1112223'),
      interruptedEvent(3, 't-aaa1112223'),
      dispatchedEvent(4, 't-aaa1112223', { workerSessionId: 'session-worker-2' }),
    ])

    expect(projection.tickets[0]).toEqual(expect.objectContaining({ stage: 'running' }))
    expect(projection.tickets[0]).not.toHaveProperty('interrupted')
  })

  it('clears the interrupted mark when an approval decision is delivered', () => {
    const projection = project([
      queuedEvent(1, 't-aaa1112223'),
      dispatchedEvent(2, 't-aaa1112223'),
      interruptedEvent(3, 't-aaa1112223'),
      pendingEvent(4, 'a-1', 't-aaa1112223'),
      decidedEvent(5, 'a-1'),
    ])

    expect(projection.tickets).toEqual([expect.objectContaining({ stage: 'running' })])
    expect(projection.tickets[0]).not.toHaveProperty('interrupted')
  })

  it('clears the interrupted mark when the turn reports', () => {
    const projection = project([
      queuedEvent(1, 't-aaa1112223'),
      dispatchedEvent(2, 't-aaa1112223'),
      interruptedEvent(3, 't-aaa1112223'),
      reportedEvent(4, 't-aaa1112223', { summary: '被中断后仍被叫停' }),
    ])

    expect(projection.tickets[0]).not.toHaveProperty('interrupted')
  })

  it('never shows interrupted on blocked or ended tickets', () => {
    const blocked = project([
      queuedEvent(1, 't-aaa1112223'),
      dispatchedEvent(2, 't-aaa1112223'),
      interruptedEvent(3, 't-aaa1112223'),
      pendingEvent(4, 'a-1', 't-aaa1112223'),
    ])
    const ended = project([
      queuedEvent(1, 't-aaa1112223'),
      dispatchedEvent(2, 't-aaa1112223'),
      interruptedEvent(3, 't-aaa1112223'),
      closedEvent(4, 't-aaa1112223', { outcome: 'completed' }),
    ])

    expect(blocked.tickets[0]).toEqual(expect.objectContaining({ stage: 'blocked' }))
    expect(blocked.tickets[0]).not.toHaveProperty('interrupted')
    expect(ended.tickets[0]).toEqual(expect.objectContaining({ stage: 'ended' }))
    expect(ended.tickets[0]).not.toHaveProperty('interrupted')
  })

  it('ignores interruption events for tickets that were never queued', () => {
    const projection = project([
      interruptedEvent(1, 't-ghost0000'),
      resumedEvent(2, 't-ghost0000'),
    ])

    expect(projection.tickets).toEqual([])
  })
})
