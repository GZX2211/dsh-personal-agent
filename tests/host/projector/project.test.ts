// tests/host/projector/project.test.ts
//
// 投影是纯函数：输入全部事件，输出工单与审批视图。断言一律落在「业务上能看到的
// 结果」（阶段、字段、顺序、计数），不断言内部累加结构。

import { describe, expect, it } from 'vitest'
import type {
  ApprovalDecidedPayload,
  ApprovalDiscardedPayload,
  ApprovalPendingPayload,
  DecisionRecordedPayload,
  EventActor,
  L2Event,
  SignalReceivedPayload,
  TaskClosedPayload,
  TaskDispatchedPayload,
  TaskInterruptedPayload,
  TaskQueuedPayload,
  TaskReportedPayload,
  TaskResumedPayload,
  TaskSupplementedPayload,
} from '../../../src/shared/events.ts'
import { SIGNAL_VIEW_LIMIT } from '../../../src/shared/signals.ts'
import type { SourceDefinition } from '../../../src/shared/sources.ts'
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

function reportedEvent(
  seq: number,
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

function supplementedEvent(
  seq: number,
  ticketId: string,
  payload: Partial<TaskSupplementedPayload> = {},
  extra: EnvelopeExtra = {},
): L2Event {
  return event(
    seq,
    'task/supplemented',
    {
      ticketId,
      targetSessionId: `session-${ticketId}`,
      text: '接口契约写错了，按新的字段名实现',
      requestedBySessionId: 'session-router-1',
      ...payload,
    },
    { actor: 'router', ...extra },
  )
}

function signalEvent(
  seq: number,
  signalId: string,
  payload: Partial<SignalReceivedPayload> = {},
  extra: EnvelopeExtra = {},
): L2Event {
  return event(
    seq,
    'signal/received',
    {
      kind: 'user-message',
      delivered: true,
      receivedAt: BASE_TIME + seq,
      signalId,
      text: `信号 ${signalId}`,
      ...payload,
    },
    { correlationId: signalId, ...extra },
  )
}

function decisionEvent(
  seq: number,
  signalId: string,
  payload: Partial<DecisionRecordedPayload> = {},
  extra: EnvelopeExtra = {},
): L2Event {
  return event(
    seq,
    'decision/recorded',
    { action: 'reply', signalId, ...payload },
    { correlationId: signalId, ...extra },
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
      signals: [],
      sources: [],
      sourceTallies: new Map(),
      sourceDefinitions: new Map(),
      stats: {
        tickets: { queued: 0, running: 0, blocked: 0, ended: 0, total: 0 },
        approvals: { pending: 0, decided: 0 },
        signals: { delivered: 0, filtered: 0, total: 0 },
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

  it('records the first dispatch time on the ticket view', () => {
    const projection = project([
      queuedEvent(1, 't-aaa1112223', {}, { time: BASE_TIME + 100 }),
      dispatchedEvent(2, 't-aaa1112223', {}, { time: BASE_TIME + 250 }),
    ])

    expect(projection.tickets).toEqual([
      expect.objectContaining({ stage: 'running', dispatchedAt: BASE_TIME + 250 }),
    ])
  })

  it('keeps the first dispatch time when the ticket is dispatched again', () => {
    const projection = project([
      queuedEvent(1, 't-aaa1112223'),
      dispatchedEvent(2, 't-aaa1112223', {}, { time: BASE_TIME + 250 }),
      interruptedEvent(3, 't-aaa1112223'),
      dispatchedEvent(4, 't-aaa1112223', { workerSessionId: 'session-worker-2' }, { time: BASE_TIME + 900 }),
    ])

    expect(projection.tickets).toEqual([
      expect.objectContaining({
        dispatchedAt: BASE_TIME + 250,
        workerSessionId: 'session-worker-2',
      }),
    ])
  })

  it('leaves queued tickets without a dispatch time', () => {
    const projection = project([queuedEvent(1, 't-aaa1112223')])

    expect(projection.tickets[0]).not.toHaveProperty('dispatchedAt')
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
        decision: { kind: 'selected', index: 1, label: '等等', answer: '先别发' },
        decidedAt: BASE_TIME + 4,
        transport: 'followup',
      }),
    ])

    expect(projection.tickets).toEqual([expect.objectContaining({ stage: 'running' })])
    expect(projection.approvals).toEqual([
      expect.objectContaining({
        id: 'a-1',
        decidedAt: BASE_TIME + 4,
        decision: { kind: 'selected', index: 1, label: '等等', answer: '先别发', transport: 'followup' },
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
      signals: { delivered: 0, filtered: 0, total: 0 },
    })
  })

  it('keeps signals out of the ticket and approval views', () => {
    const projection = project([signalEvent(1, 's-aaaa'), decisionEvent(2, 's-aaaa')])

    expect(projection.tickets).toEqual([])
    expect(projection.approvals).toEqual([])
    expect(projection.stats.tickets.total).toBe(0)
    expect(projection.stats.approvals).toEqual({ pending: 0, decided: 0 })
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

  it('keeps the running stage and refreshes updatedAt when a supplement arrives', () => {
    const projection = project([
      queuedEvent(1, 't-aaa1112223'),
      dispatchedEvent(2, 't-aaa1112223'),
      supplementedEvent(3, 't-aaa1112223', {}, { time: BASE_TIME + 500 }),
    ])

    expect(projection.tickets).toEqual([
      expect.objectContaining({
        stage: 'running',
        dispatchedAt: BASE_TIME + 2,
        updatedAt: BASE_TIME + 500,
      }),
    ])
  })

  it('does not release a blocked ticket when a supplement arrives', () => {
    const projection = project([
      queuedEvent(1, 't-aaa1112223'),
      dispatchedEvent(2, 't-aaa1112223'),
      pendingEvent(3, 'a-1', 't-aaa1112223'),
      supplementedEvent(4, 't-aaa1112223'),
    ])

    // 补充只是送达一条信息：它不替人做审批决定，阻塞原因仍然成立。
    expect(projection.tickets).toEqual([expect.objectContaining({ stage: 'blocked' })])
  })

  it('keeps an ended ticket ended when a supplement arrives late', () => {
    const projection = project([
      queuedEvent(1, 't-aaa1112223'),
      dispatchedEvent(2, 't-aaa1112223'),
      reportedEvent(3, 't-aaa1112223'),
      closedEvent(4, 't-aaa1112223', { outcome: 'failed', reason: 'turn-error' }),
      supplementedEvent(5, 't-aaa1112223'),
    ])

    expect(projection.tickets).toEqual([
      expect.objectContaining({ stage: 'ended', outcome: 'failed', updatedAt: BASE_TIME + 5 }),
    ])
  })

  it('ignores a supplement for a ticket that was never queued', () => {
    const projection = project([supplementedEvent(1, 't-unknown0000')])

    expect(projection.tickets).toEqual([])
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

  it('carries approval attachments, risk and requester into the view', () => {
    const projection = project([
      queuedEvent(1, 't-aaa1112223'),
      dispatchedEvent(2, 't-aaa1112223'),
      pendingEvent(
        3,
        'a-1',
        't-aaa1112223',
        {
          risk: 'high',
          attachments: ['D:/pa-work/t-aaa1112223/notes.md'],
        },
      ),
    ])

    expect(projection.approvals).toEqual([
      {
        id: 'a-1',
        ticketId: 't-aaa1112223',
        question: '发布到生产会立刻影响用户。',
        options: [
          { label: '发布', description: '立刻上线' },
          { label: '等等', description: '继续观察' },
        ],
        attachments: ['D:/pa-work/t-aaa1112223/notes.md'],
        risk: 'high',
        requestedBySessionId: 'session-t-aaa1112223',
        createdAt: BASE_TIME + 3,
      },
    ])
  })

  it('keeps a standalone approval visible without blocking any ticket', () => {
    const projection = project([
      queuedEvent(1, 't-aaa1112223'),
      dispatchedEvent(2, 't-aaa1112223'),
      event(3, 'approval/pending', {
        approvalId: 'a-standalone',
        question: '发布到生产会立刻影响用户。',
        options: [{ label: '发布', description: '立刻上线' }],
        requestedBySessionId: 'session-standalone',
      }),
    ])

    expect(projection.approvals).toEqual([
      {
        id: 'a-standalone',
        question: '发布到生产会立刻影响用户。',
        options: [{ label: '发布', description: '立刻上线' }],
        requestedBySessionId: 'session-standalone',
        createdAt: BASE_TIME + 3,
      },
    ])
    expect(projection.approvals[0]).not.toHaveProperty('ticketId')
    expect(projection.tickets).toEqual([expect.objectContaining({ stage: 'running' })])
  })

  it('ignores retired payload fields such as title and fields', () => {
    const projection = project([
      queuedEvent(1, 't-aaa1112223'),
      dispatchedEvent(2, 't-aaa1112223'),
      event(3, 'approval/pending', {
        approvalId: 'a-1',
        ticketId: 't-aaa1112223',
        title: '已退役的标题',
        question: '发布到生产会立刻影响用户。',
        options: [{ label: '发布', description: '立刻上线' }],
        fields: [{ key: 'window', label: '发布时间', type: 'text' }],
        requestedBySessionId: 'session-t-aaa1112223',
      }),
    ])

    expect(projection.approvals[0]).toEqual({
      id: 'a-1',
      ticketId: 't-aaa1112223',
      question: '发布到生产会立刻影响用户。',
      options: [{ label: '发布', description: '立刻上线' }],
      requestedBySessionId: 'session-t-aaa1112223',
      createdAt: BASE_TIME + 3,
    })
  })

  it('records a skipped decision without an option index', () => {
    const projection = project([
      queuedEvent(1, 't-aaa1112223'),
      dispatchedEvent(2, 't-aaa1112223'),
      pendingEvent(3, 'a-1', 't-aaa1112223'),
      decidedEvent(4, 'a-1', { decision: { kind: 'skipped', answer: '你自己看着办' } }),
    ])

    expect(projection.approvals).toEqual([
      expect.objectContaining({
        decidedAt: BASE_TIME + 4,
        decision: { kind: 'skipped', answer: '你自己看着办', transport: 'inline' },
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

  it('carries the brief fields into the ticket view', () => {
    const projection = project([
      queuedEvent(1, 't-aaa1112223', {
        context: '用户原话：今晚发',
        constraints: ['不要改数据库', '不要动灰度开关'],
        expectedOutput: '生产返回 200',
      }),
    ])

    expect(projection.tickets[0]).toEqual(
      expect.objectContaining({
        context: '用户原话：今晚发',
        constraints: ['不要改数据库', '不要动灰度开关'],
        expectedOutput: '生产返回 200',
      }),
    )
  })

  it('ignores interruption events for tickets that were never queued', () => {
    const projection = project([
      interruptedEvent(1, 't-ghost0000'),
      resumedEvent(2, 't-ghost0000'),
    ])

    expect(projection.tickets).toEqual([])
  })

  it('keeps the first request when the same approval id is appended twice', () => {
    const projection = project([
      pendingEvent(1, 'a-1', 't-aaa1112223', { question: '第一次提问' }),
      pendingEvent(2, 'a-1', 't-aaa1112223', { question: '第二次提问' }),
    ])

    expect(projection.approvals).toHaveLength(1)
    expect(projection.approvals[0]?.question).toBe('第一次提问')
  })

  it('refreshes the brief when a queued ticket is queued again before dispatch', () => {
    const projection = project([
      queuedEvent(1, 't-aaa1112223', { title: '旧标题', goal: '旧目标', queueReason: 'capacity-full' }),
      queuedEvent(2, 't-aaa1112223', { title: '新标题', goal: '新目标', queueReason: 'worker-busy' }),
    ])

    expect(projection.tickets[0]).toEqual(
      expect.objectContaining({
        stage: 'queued',
        title: '新标题',
        goal: '新目标',
        queueReason: 'worker-busy',
      }),
    )
  })
})

describe('signal projection', () => {
  it('attaches the decision to its signal', () => {
    const projection = project([
      signalEvent(1, 's-aaaaaaaaaa'),
      decisionEvent(2, 's-aaaaaaaaaa', { action: 'dispatch', ticketId: 't-abcdef1234' }),
    ])

    expect(projection.signals).toEqual([
      expect.objectContaining({
        signalId: 's-aaaaaaaaaa',
        kind: 'user-message',
        delivered: true,
        text: '信号 s-aaaaaaaaaa',
        decision: { action: 'dispatch', ticketId: 't-abcdef1234', at: BASE_TIME + 2 },
      }),
    ])
  })

  it('leaves a signal pending when no decision exists', () => {
    const projection = project([signalEvent(1, 's-aaaaaaaaaa')])

    expect(projection.signals[0]).not.toHaveProperty('decision')
  })

  it('keeps a filtered signal with its rule and no decision', () => {
    const projection = project([
      signalEvent(1, 's-ffffffffff', {
        kind: 'perception',
        delivered: false,
        rule: 'min-gap',
        sourceId: 'src-1',
        sourceName: '线上日志',
        threadId: 'th-1',
        threadName: '错误',
      }),
    ])

    expect(projection.signals[0]).toEqual(
      expect.objectContaining({
        kind: 'perception',
        delivered: false,
        rule: 'min-gap',
        sourceName: '线上日志',
        threadName: '错误',
      }),
    )
    expect(projection.signals[0]).not.toHaveProperty('decision')
  })

  it('orders signals newest first, breaking ties by signal id', () => {
    const projection = project([
      signalEvent(1, 's-bbbbbbbbbb', { receivedAt: BASE_TIME + 100 }),
      signalEvent(2, 's-aaaaaaaaaa', { receivedAt: BASE_TIME + 100 }),
      signalEvent(3, 's-cccccccccc', { receivedAt: BASE_TIME + 50 }),
    ])

    expect(projection.signals.map(signal => signal.signalId)).toEqual([
      's-bbbbbbbbbb',
      's-aaaaaaaaaa',
      's-cccccccccc',
    ])
  })

  it('keeps only the newest signals in the view', () => {
    const events = Array.from({ length: SIGNAL_VIEW_LIMIT + 50 }, (_, index) =>
      signalEvent(index + 1, `s-${String(index).padStart(10, '0')}`, {
        receivedAt: BASE_TIME + index,
      }),
    )

    const projection = project(events)

    expect(projection.signals).toHaveLength(SIGNAL_VIEW_LIMIT)
    expect(projection.signals[0]?.receivedAt).toBe(BASE_TIME + SIGNAL_VIEW_LIMIT + 49)
    expect(projection.signals.at(-1)?.receivedAt).toBe(BASE_TIME + 50)
  })

  it('counts every signal, including those beyond the view limit', () => {
    const total = SIGNAL_VIEW_LIMIT + 50
    const filtered = total / 5
    const events = Array.from({ length: total }, (_, index) =>
      signalEvent(index + 1, `s-${String(index).padStart(10, '0')}`, {
        delivered: index % 5 !== 0,
      }),
    )

    const projection = project(events)

    expect(projection.signals).toHaveLength(SIGNAL_VIEW_LIMIT)
    expect(projection.stats.signals).toEqual({ delivered: total - filtered, filtered, total })
  })

  it('lets a later decision win over an earlier one', () => {
    const projection = project([
      signalEvent(1, 's-aaaaaaaaaa'),
      decisionEvent(2, 's-aaaaaaaaaa', { action: 'reply', inferred: true }),
      decisionEvent(3, 's-aaaaaaaaaa', { action: 'dispatch', ticketId: 't-abcdef1234' }),
    ])

    expect(projection.signals[0]?.decision).toEqual({
      action: 'dispatch',
      ticketId: 't-abcdef1234',
      at: BASE_TIME + 3,
    })
  })

  it('ignores a decision for a signal that was never recorded', () => {
    const projection = project([decisionEvent(1, 's-ghost00000', { action: 'reply' })])

    expect(projection.signals).toEqual([])
    expect(projection.stats.signals).toEqual({ delivered: 0, filtered: 0, total: 0 })
  })

  it('keeps the first account when the same signal is appended twice', () => {
    const projection = project([
      signalEvent(1, 's-aaaaaaaaaa', { text: '第一次观察' }),
      signalEvent(2, 's-aaaaaaaaaa', { text: '第二次观察', receivedAt: BASE_TIME + 999 }),
    ])

    expect(projection.signals).toEqual([
      expect.objectContaining({ text: '第一次观察', receivedAt: BASE_TIME + 1 }),
    ])
    expect(projection.stats.signals.total).toBe(1)
  })

  it('reports an absent account as empty text', () => {
    const projection = project([
      signalEvent(1, 's-aaaaaaaaaa', { kind: 'timer', text: undefined }),
    ])

    expect(projection.signals[0]?.text).toBe('')
  })

  it('carries the fallback marker of an inferred decision', () => {
    const projection = project([
      signalEvent(1, 's-aaaaaaaaaa'),
      decisionEvent(2, 's-aaaaaaaaaa', { action: 'reply', inferred: true, reason: 'aborted' }),
    ])

    expect(projection.signals[0]?.decision).toEqual(
      expect.objectContaining({ action: 'reply', inferred: true }),
    )
  })
})

function sourceDefinition(overrides: Partial<SourceDefinition> = {}): SourceDefinition {
  return {
    id: 'src-1',
    name: '本地文件',
    enabled: true,
    channel: { kind: 'fs-watch', paths: ['D:/tmp/a.txt'] },
    threads: [
      { id: 'th-changes', name: '变更', enabled: true },
      { id: 'th-errors', name: '错误', enabled: false },
    ],
    createdAt: BASE_TIME + 1,
    updatedAt: BASE_TIME + 1,
    ...overrides,
  }
}

function createdEvent(seq: number, definition = sourceDefinition()): L2Event {
  return event(seq, 'source/created', { sourceId: definition.id, definition }, { correlationId: definition.id })
}

function updatedEvent(seq: number, definition = sourceDefinition()): L2Event {
  return event(seq, 'source/updated', { sourceId: definition.id, definition }, { correlationId: definition.id })
}

function removedEvent(seq: number, sourceId = 'src-1'): L2Event {
  return event(seq, 'source/removed', { sourceId }, { correlationId: sourceId })
}

function sourceSignal(
  seq: number,
  sourceId: string,
  threadId: string,
  payload: Partial<SignalReceivedPayload> = {},
): L2Event {
  const signalId = `s-${String(seq).padStart(10, '0')}`
  return event(
    seq,
    'signal/received',
    {
      kind: 'perception',
      delivered: true,
      receivedAt: BASE_TIME + seq,
      signalId,
      sourceId,
      threadId,
      text: `感知 ${seq}`,
      ...payload,
    },
    { correlationId: signalId },
  )
}

describe('source projection', () => {
  it('projects a created source with its channel and threads', () => {
    const projection = project([createdEvent(1)])

    expect(projection.sources).toEqual([
      {
        id: 'src-1',
        name: '本地文件',
        enabled: true,
        channelKind: 'fs-watch',
        config: { kind: 'fs-watch', paths: ['D:/tmp/a.txt'], recursive: false },
        threads: [
          { id: 'th-changes', name: '变更', enabled: true, deliveredCount: 0, filteredCount: 0 },
          { id: 'th-errors', name: '错误', enabled: false, deliveredCount: 0, filteredCount: 0 },
        ],
        deliveredCount: 0,
        filteredCount: 0,
      },
    ])
  })

  it('summarizes a file source without exposing its ignore patterns', () => {
    const projection = project([
      createdEvent(
        1,
        sourceDefinition({
          channel: {
            kind: 'fs-watch',
            paths: ['D:/a', 'D:/b'],
            recursive: true,
            debounceMs: 300,
            ignore: ['**/node_modules/**'],
          },
        }),
      ),
    ])

    expect(projection.sources[0]?.config).toEqual({
      kind: 'fs-watch',
      paths: ['D:/a', 'D:/b'],
      recursive: true,
      debounceMs: 300,
    })
  })

  it('summarizes the subscribed event types of a host-event source', () => {
    const projection = project([
      createdEvent(
        1,
        sourceDefinition({
          channel: {
            kind: 'host-event',
            subscriptions: [
              { event: 'task/closed', thread: 'a', statement: '一' },
              { event: 'task/closed', thread: 'b', statement: '二' },
              { event: 'approval/pending', thread: 'c', statement: '三' },
            ],
          },
        }),
      ),
    ])

    expect(projection.sources[0]?.config).toEqual({
      kind: 'host-event',
      events: ['task/closed', 'approval/pending'],
    })
  })

  it('summarizes a script source by its command only', () => {
    const projection = project([
      createdEvent(
        1,
        sourceDefinition({
          channel: {
            kind: 'script',
            command: 'pwsh',
            args: ['-File', '{script}'],
            scriptPath: 'perception/src-1/watch.ps1',
            scriptHash: 'deadbeef',
          },
        }),
      ),
    ])

    expect(projection.sources[0]?.config).toEqual({ kind: 'script', command: 'pwsh' })
  })

  it('folds an update onto the existing source', () => {
    const projection = project([
      createdEvent(1),
      updatedEvent(2, sourceDefinition({ name: '改名后的来源', description: '盯一个文件' })),
    ])

    expect(projection.sources[0]).toMatchObject({ id: 'src-1', name: '改名后的来源', description: '盯一个文件' })
    expect(projection.sources).toHaveLength(1)
  })

  it('keeps the first definition when the same source is created twice', () => {
    const projection = project([
      createdEvent(1),
      createdEvent(2, sourceDefinition({ name: '第二次创建' })),
    ])

    expect(projection.sources[0]?.name).toBe('本地文件')
  })

  it('ignores an update for a source that was never created', () => {
    const projection = project([updatedEvent(1, sourceDefinition({ id: 'src-ghost' }))])

    expect(projection.sources).toEqual([])
  })

  it('hides a removed source and does not resurrect it by a later update', () => {
    const projection = project([
      createdEvent(1),
      updatedEvent(2, sourceDefinition({ name: '删除前' })),
      removedEvent(3),
      updatedEvent(4, sourceDefinition({ name: '删除后' })),
    ])

    expect(projection.sources).toEqual([])
  })

  it('orders sources by creation time', () => {
    const projection = project([
      createdEvent(1, sourceDefinition({ id: 'src-late', createdAt: BASE_TIME + 300 })),
      createdEvent(2, sourceDefinition({ id: 'src-early', createdAt: BASE_TIME + 100 })),
    ])

    expect(projection.sources.map(source => source.id)).toEqual(['src-early', 'src-late'])
  })

  it('counts delivered and filtered signals per source and per thread', () => {
    const projection = project([
      createdEvent(1),
      sourceSignal(2, 'src-1', 'th-changes'),
      sourceSignal(3, 'src-1', 'th-changes', { delivered: false, rule: 'min-gap' }),
      sourceSignal(4, 'src-1', 'th-errors'),
    ])

    expect(projection.sources[0]).toMatchObject({
      deliveredCount: 2,
      filteredCount: 1,
      lastEventAt: BASE_TIME + 4,
      threads: [
        { id: 'th-changes', deliveredCount: 1, filteredCount: 1, lastEventAt: BASE_TIME + 3 },
        { id: 'th-errors', deliveredCount: 1, filteredCount: 0, lastEventAt: BASE_TIME + 4 },
      ],
    })
    expect(projection.sourceTallies.get('src-1')).toEqual({
      delivered: 2,
      filtered: 1,
      lastEventAt: BASE_TIME + 4,
      lastDeliveredAt: BASE_TIME + 4,
    })
  })

  it('ignores signals of sources that no longer exist', () => {
    const projection = project([createdEvent(1), sourceSignal(2, 'src-1', 'th-changes'), removedEvent(3)])

    expect(projection.sources).toEqual([])
    // 信号事实仍在（事件页要能解释它从哪来），只是来源不再出现在来源页。
    expect(projection.signals).toHaveLength(1)
    expect(projection.sourceTallies.get('src-1')?.delivered).toBe(1)
  })

  it('exposes the full definition so the runtime can start it', () => {
    const projection = project([createdEvent(1), removedEvent(2)])

    expect(projection.sourceDefinitions.get('src-1')).toBeUndefined()
    expect(project([createdEvent(1)]).sourceDefinitions.get('src-1')).toEqual(sourceDefinition())
  })
})
