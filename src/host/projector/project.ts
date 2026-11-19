// src/host/projector/project.ts
//
// 账本投影：纯函数，输入即全部事实，不读环境。工单阶段不落库，每次从事件序列
// 现算——这样"已结束 / 阻塞中"永远与账本一致，不会出现被改写的状态字段。
// 信号同理：它的事实是账本里的 `signal/received` 与 `decision/recorded`。

import type {
  ApprovalRisk,
  ApprovalView,
  RecordedApprovalDecision,
} from '../../shared/approvals.ts'
import type {
  ApprovalStats,
  SnapshotResponse,
  SnapshotStats,
  TicketStats,
} from '../../shared/api.ts'
import type { L2Event, SignalKind } from '../../shared/events.ts'
import type { SignalDecisionView, SignalView } from '../../shared/signals.ts'
import { SIGNAL_VIEW_LIMIT } from '../../shared/signals.ts'
import type { QueueReason, TicketOutcome, TicketStage, TicketView } from '../../shared/tickets.ts'
import { shortTicketId } from '../../shared/tickets.ts'

/** 总控台一次刷新所需的全部派生状态（方案 §3.4）；与 HTTP 快照是同一份契约。 */
export type Projection = SnapshotResponse

interface TicketAccumulator {
  id: string
  title: string
  goal: string
  context?: string
  constraints?: string[]
  expectedOutput?: string
  queueReason?: QueueReason
  directory?: string
  workerSessionId?: string
  createdAt: number
  updatedAt: number
  queuedSeq: number
  dispatched: boolean
  /** worker 回合被中断、尚未被任何后续事实清除；仍算进行中并占槽位。 */
  interrupted: boolean
  endedAt?: number
  outcome?: TicketOutcome
  report?: string
}

interface ApprovalAccumulator {
  id: string
  /** 独立审批不绑定工单。 */
  ticketId?: string
  question: string
  options: ApprovalView['options']
  attachments?: string[]
  risk?: ApprovalRisk
  requestedBySessionId: string
  createdAt: number
  requestSeq: number
  decidedAt?: number
  decision?: RecordedApprovalDecision
  discarded: boolean
}

interface SignalAccumulator {
  signalId: string
  kind: SignalKind
  receivedAt: number
  delivered: boolean
  rule?: string
  sourceId?: string
  sourceName?: string
  threadId?: string
  threadName?: string
  externalId?: string
  text: string
  messageId?: string
  decision?: SignalDecisionView
  /** 决定所属的账本序号：同一信号被记了多条决定时，后写的赢。 */
  decisionSeq?: number
}

/**
 * 从全部事件派生视图。
 *
 * 输入可能乱序（重放、调用方拼接），因此先按 `seq` 稳定排序：阶段由序列先后决定，
 * 不由墙钟决定。时间戳只用于展示与 `updatedAt`，回拨时取最大值兜底。
 */
export function project(events: readonly L2Event[]): Projection {
  const tickets = new Map<string, TicketAccumulator>()
  const approvals = new Map<string, ApprovalAccumulator>()
  const signals = new Map<string, SignalAccumulator>()

  for (const event of [...events].sort((left, right) => left.seq - right.seq)) {
    applyEvent(tickets, approvals, signals, event)
  }

  const pendingTickets = new Set<string>()
  for (const approval of approvals.values()) {
    if (approval.discarded || approval.decidedAt !== undefined || approval.ticketId === undefined) continue
    pendingTickets.add(approval.ticketId)
  }

  const ticketViews = [...tickets.values()]
    .map(ticket => toTicketView(ticket, pendingTickets))
    .sort((left, right) => left.createdAt - right.createdAt || left.id.localeCompare(right.id))

  const visibleApprovals = [...approvals.values()].filter(approval => !approval.discarded)
  const pendingApprovals = visibleApprovals
    .filter(approval => approval.decidedAt === undefined)
    .sort((left, right) => left.createdAt - right.createdAt || left.requestSeq - right.requestSeq)
  const decidedApprovals = visibleApprovals
    .filter(approval => approval.decidedAt !== undefined)
    .sort(
      (left, right) =>
        (right.decidedAt ?? 0) - (left.decidedAt ?? 0) || left.id.localeCompare(right.id),
    )

  return {
    tickets: ticketViews,
    approvals: [...pendingApprovals, ...decidedApprovals].map(toApprovalView),
    signals: toSignalViews(signals),
    stats: countStats(ticketViews, visibleApprovals, signals),
  }
}

function applyEvent(
  tickets: Map<string, TicketAccumulator>,
  approvals: Map<string, ApprovalAccumulator>,
  signals: Map<string, SignalAccumulator>,
  event: L2Event,
): void {
  switch (event.type) {
    case 'task/queued': {
      const existing = tickets.get(event.payload.ticketId)
      if (existing === undefined) {
        tickets.set(event.payload.ticketId, {
          id: event.payload.ticketId,
          title: event.payload.title,
          goal: event.payload.goal,
          context: event.payload.context,
          constraints: event.payload.constraints,
          expectedOutput: event.payload.expectedOutput,
          queueReason: event.payload.queueReason,
          directory: event.payload.directory,
          createdAt: event.time,
          updatedAt: event.time,
          queuedSeq: event.seq,
          dispatched: false,
          interrupted: false,
        })
        return
      }
      // 已放行后重复入队不改变阶段（放行是更强的既成事实），只刷新可见信息。
      existing.updatedAt = latest(existing.updatedAt, event.time)
      if (!existing.dispatched) {
        existing.queueReason = event.payload.queueReason
        existing.title = event.payload.title
        existing.goal = event.payload.goal
        existing.context = event.payload.context
        existing.constraints = event.payload.constraints
        existing.expectedOutput = event.payload.expectedOutput
        if (event.payload.directory !== undefined) existing.directory = event.payload.directory
      }
      return
    }
    case 'task/dispatched': {
      const ticket = tickets.get(event.payload.ticketId)
      if (ticket === undefined) return
      ticket.dispatched = true
      ticket.interrupted = false
      ticket.workerSessionId = event.payload.workerSessionId
      if (event.payload.directory !== undefined) ticket.directory = event.payload.directory
      ticket.updatedAt = latest(ticket.updatedAt, event.time)
      return
    }
    case 'task/interrupted': {
      const ticket = tickets.get(event.payload.ticketId)
      if (ticket === undefined) return
      ticket.interrupted = true
      ticket.updatedAt = latest(ticket.updatedAt, event.time)
      return
    }
    case 'task/resumed': {
      const ticket = tickets.get(event.payload.ticketId)
      if (ticket === undefined) return
      ticket.interrupted = false
      ticket.updatedAt = latest(ticket.updatedAt, event.time)
      return
    }
    case 'task/reported': {
      const ticket = tickets.get(event.payload.ticketId)
      if (ticket === undefined) return
      ticket.report = event.payload.summary
      ticket.interrupted = false
      ticket.updatedAt = latest(ticket.updatedAt, event.time)
      return
    }
    case 'task/closed': {
      const ticket = tickets.get(event.payload.ticketId)
      if (ticket === undefined) return
      // 关闭是终态：第一次关闭定下结束时间与结果，之后的重复关闭不再改写。
      if (ticket.endedAt === undefined) {
        ticket.endedAt = event.time
        ticket.outcome = event.payload.outcome
      }
      ticket.interrupted = false
      ticket.updatedAt = latest(ticket.updatedAt, event.time)
      return
    }
    case 'approval/pending': {
      if (approvals.has(event.payload.approvalId)) return
      approvals.set(event.payload.approvalId, {
        id: event.payload.approvalId,
        ...(event.payload.ticketId === undefined ? {} : { ticketId: event.payload.ticketId }),
        question: event.payload.question,
        options: event.payload.options,
        attachments: event.payload.attachments,
        risk: event.payload.risk,
        requestedBySessionId: event.payload.requestedBySessionId,
        createdAt: event.time,
        requestSeq: event.seq,
        discarded: false,
      })
      return
    }
    case 'approval/decided': {
      const approval = approvals.get(event.payload.approvalId)
      if (approval === undefined || approval.discarded) return
      approval.decidedAt = event.payload.decidedAt
      approval.decision = { ...event.payload.decision, transport: event.payload.transport }
      // 决定送达后 worker 会被唤醒继续，下一次 turn/start 之前也不该再显示「已中断」。
      // 独立审批不绑定工单，因此不会影响任何工单的阶段。
      if (approval.ticketId !== undefined) {
        const ticket = tickets.get(approval.ticketId)
        if (ticket !== undefined) ticket.interrupted = false
      }
      return
    }
    case 'approval/discarded': {
      const approval = approvals.get(event.payload.approvalId)
      if (approval === undefined) return
      approval.discarded = true
      return
    }
    case 'signal/received': {
      // 同一 signalId 只建立一次：重放的同一条事实不改写已记录的身份与时刻。
      if (signals.has(event.payload.signalId)) return
      signals.set(event.payload.signalId, {
        signalId: event.payload.signalId,
        kind: event.payload.kind,
        receivedAt: event.payload.receivedAt,
        delivered: event.payload.delivered,
        rule: event.payload.rule,
        sourceId: event.payload.sourceId,
        sourceName: event.payload.sourceName,
        threadId: event.payload.threadId,
        threadName: event.payload.threadName,
        externalId: event.payload.externalId,
        text: event.payload.text ?? '',
        messageId: event.payload.messageId,
      })
      return
    }
    case 'decision/recorded': {
      const signal = signals.get(event.payload.signalId)
      // 没有信号的决定是孤儿：它解释不了任何一次输入，投影不凭空造一条信号。
      if (signal === undefined) return
      if (signal.decisionSeq !== undefined && signal.decisionSeq > event.seq) return
      signal.decision = {
        action: event.payload.action,
        ...(event.payload.ticketId === undefined ? {} : { ticketId: event.payload.ticketId }),
        ...(event.payload.inferred === undefined ? {} : { inferred: event.payload.inferred }),
        at: event.time,
      }
      signal.decisionSeq = event.seq
      return
    }
  }
}

function toTicketView(ticket: TicketAccumulator, pendingTickets: ReadonlySet<string>): TicketView {
  const view: TicketView = {
    id: ticket.id,
    shortId: shortTicketId(ticket.id),
    title: ticket.title,
    stage: stageOf(ticket, pendingTickets),
    goal: ticket.goal,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
  }
  // 排队原因只对仍在待处理的工单有意义；放行后它解释不了任何现状。
  if (view.stage === 'queued' && ticket.queueReason !== undefined) view.queueReason = ticket.queueReason
  // 中断只修饰「进行中」：待处理不可能中断，阻塞中与已结束各有更准确的状态。
  if (view.stage === 'running' && ticket.interrupted) view.interrupted = true
  if (ticket.context !== undefined) view.context = ticket.context
  if (ticket.constraints !== undefined) view.constraints = ticket.constraints
  if (ticket.expectedOutput !== undefined) view.expectedOutput = ticket.expectedOutput
  if (ticket.workerSessionId !== undefined) view.workerSessionId = ticket.workerSessionId
  if (ticket.directory !== undefined) view.directory = ticket.directory
  if (ticket.endedAt !== undefined) view.endedAt = ticket.endedAt
  if (ticket.outcome !== undefined) view.outcome = ticket.outcome
  if (ticket.report !== undefined) view.report = ticket.report
  return view
}

function stageOf(ticket: TicketAccumulator, pendingTickets: ReadonlySet<string>): TicketStage {
  if (ticket.endedAt !== undefined) return 'ended'
  if (!ticket.dispatched) return 'queued'
  return pendingTickets.has(ticket.id) ? 'blocked' : 'running'
}

function toApprovalView(approval: ApprovalAccumulator): ApprovalView {
  const view: ApprovalView = {
    id: approval.id,
    question: approval.question,
    options: approval.options,
    requestedBySessionId: approval.requestedBySessionId,
    createdAt: approval.createdAt,
  }
  if (approval.ticketId !== undefined) view.ticketId = approval.ticketId
  if (approval.attachments !== undefined && approval.attachments.length > 0) {
    view.attachments = approval.attachments
  }
  if (approval.risk !== undefined) view.risk = approval.risk
  if (approval.decidedAt !== undefined) view.decidedAt = approval.decidedAt
  if (approval.decision !== undefined) view.decision = approval.decision
  return view
}

function toSignalViews(signals: Map<string, SignalAccumulator>): SignalView[] {
  // 视图只带最近一段；统计仍按全部信号算，历史事实不因展示截断而消失。
  return [...signals.values()]
    .sort(
      (left, right) =>
        right.receivedAt - left.receivedAt || right.signalId.localeCompare(left.signalId),
    )
    .slice(0, SIGNAL_VIEW_LIMIT)
    .map(toSignalView)
}

function toSignalView(signal: SignalAccumulator): SignalView {
  const view: SignalView = {
    signalId: signal.signalId,
    kind: signal.kind,
    receivedAt: signal.receivedAt,
    delivered: signal.delivered,
    text: signal.text,
  }
  if (signal.rule !== undefined) view.rule = signal.rule
  if (signal.sourceId !== undefined) view.sourceId = signal.sourceId
  if (signal.sourceName !== undefined) view.sourceName = signal.sourceName
  if (signal.threadId !== undefined) view.threadId = signal.threadId
  if (signal.threadName !== undefined) view.threadName = signal.threadName
  if (signal.externalId !== undefined) view.externalId = signal.externalId
  if (signal.messageId !== undefined) view.messageId = signal.messageId
  if (signal.decision !== undefined) view.decision = signal.decision
  return view
}

function countStats(
  tickets: readonly TicketView[],
  approvals: readonly ApprovalAccumulator[],
  signals: ReadonlyMap<string, SignalAccumulator>,
): SnapshotStats {
  const stats: SnapshotStats = {
    tickets: { queued: 0, running: 0, blocked: 0, ended: 0, total: tickets.length },
    approvals: { pending: 0, decided: 0 },
    signals: { delivered: 0, filtered: 0, total: 0 },
  }
  for (const ticket of tickets) stats.tickets[ticket.stage] += 1
  for (const approval of approvals) {
    if (approval.decidedAt === undefined) stats.approvals.pending += 1
    else stats.approvals.decided += 1
  }
  for (const signal of signals.values()) {
    if (signal.delivered) stats.signals.delivered += 1
    else stats.signals.filtered += 1
    stats.signals.total += 1
  }
  return stats
}

function latest(current: number, candidate: number): number {
  return candidate > current ? candidate : current
}
