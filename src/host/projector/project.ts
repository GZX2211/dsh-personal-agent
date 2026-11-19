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
  SnapshotStats,
  TicketStats,
} from '../../shared/api.ts'
import type { L2Event } from '../../shared/events.ts'
import type { SignalView } from '../../shared/signals.ts'
import { SIGNAL_VIEW_LIMIT } from '../../shared/signals.ts'
import type { SourceDefinition, SourceSnapshot } from '../../shared/sources.ts'
import type { QueueReason, TicketOutcome, TicketStage, TicketView } from '../../shared/tickets.ts'
import { shortTicketId } from '../../shared/tickets.ts'
import {
  applySignalEvent,
  toSignalViews,
  type SignalAccumulator,
} from './signal-query.ts'

/**
 * 账本投影：总控台一次刷新所需的派生状态。
 *
 * 与 `SnapshotResponse` 的区别只在两处：来源不带运行时状态（那是内存事实），
 * 定时来源来自官方调度器（异步读取，不进纯函数）。两者都由装配层在组装快照时补上。
 */
export interface Projection {
  tickets: TicketView[]
  approvals: ApprovalView[]
  signals: SignalView[]
  sources: SourceSnapshot[]
  /** 按来源聚合的信号计数；定时分区与来源页共用同一份事实。 */
  sourceTallies: ReadonlyMap<string, SourceTally>
  /** 未删除来源的完整定义；装配时用它还原并启动 Channel。 */
  sourceDefinitions: ReadonlyMap<string, SourceDefinition>
  stats: SnapshotStats
}

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

interface SourceAccumulator {
  definition: SourceDefinition
  /** 已删除的来源不再出现在视图里；它的历史信号仍以 sourceId 作为坐标。 */
  removed: boolean
}

/** 来源与线程的计数：从信号事实聚合，不是独立维护的状态。 */
export interface SourceTally {
  delivered: number
  filtered: number
  lastEventAt?: number
  /** 最近一次「投递」的时刻（不含被过滤的）——定时分区用它展示最近投递。 */
  lastDeliveredAt?: number
}

interface ThreadTally {
  delivered: number
  filtered: number
  lastEventAt?: number
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
  const sources = new Map<string, SourceAccumulator>()

  for (const event of orderedBySeq(events)) {
    applySignalEvent(signals, event)
    applyDomainEvent(tickets, approvals, sources, event)
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

  const tallies = tallySignals(signals)

  return {
    tickets: ticketViews,
    approvals: [...pendingApprovals, ...decidedApprovals].map(toApprovalView),
    signals: toSignalViews(signals, SIGNAL_VIEW_LIMIT),
    sources: toSourceSnapshots(sources, tallies),
    sourceTallies: tallies.sources,
    sourceDefinitions: sourceDefinitionsOf(sources),
    stats: countStats(ticketViews, visibleApprovals, signals),
  }
}

/**
 * 全量信号投影：事件页搜索用它翻历史，快照只取其中最近一段。
 *
 * 与 `project()` 共用同一套折叠规则（`applySignalEvent`），因此两处的结局与去重
 * 口径不会走散。
 */
export function projectSignals(events: readonly L2Event[]): SignalView[] {
  const signals = new Map<string, SignalAccumulator>()
  for (const event of orderedBySeq(events)) applySignalEvent(signals, event)
  return toSignalViews(signals)
}

/**
 * 输入可能乱序（重放、调用方拼接），投影先按 `seq` 稳定排序。
 *
 * 阶段由序列先后决定，不由墙钟决定；时间戳只用于展示。
 */
function orderedBySeq(events: readonly L2Event[]): L2Event[] {
  return [...events].sort((left, right) => left.seq - right.seq)
}

function applyDomainEvent(
  tickets: Map<string, TicketAccumulator>,
  approvals: Map<string, ApprovalAccumulator>,
  sources: Map<string, SourceAccumulator>,
  event: L2Event,
): void {
  switch (event.type) {
    case 'source/created': {
      // 同一来源只创建一次：重复创建不覆盖已记录的定义与创建时间。
      if (sources.has(event.payload.sourceId)) return
      sources.set(event.payload.sourceId, { definition: event.payload.definition, removed: false })
      return
    }
    case 'source/updated': {
      const source = sources.get(event.payload.sourceId)
      // 已删除的来源不能被更新复活：删除是更强的既成事实。
      if (source === undefined || source.removed) return
      source.definition = event.payload.definition
      return
    }
    case 'source/removed': {
      const source = sources.get(event.payload.sourceId)
      if (source !== undefined) source.removed = true
      return
    }
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

/** 按来源与按线程的两层计数。 */
interface SignalTallies {
  sources: Map<string, SourceTally>
  threads: Map<string, Map<string, SourceTally>>
}

function toSourceSnapshots(
  sources: ReadonlyMap<string, SourceAccumulator>,
  tallies: SignalTallies,
): SourceSnapshot[] {
  return [...sources.values()]
    .filter(source => !source.removed)
    .sort(
      (left, right) =>
        left.definition.createdAt - right.definition.createdAt ||
        left.definition.id.localeCompare(right.definition.id),
    )
    .map(source => toSourceSnapshot(source, tallies))
}

/** 一次遍历把信号按来源与线程归堆：计数是派生事实，不另存一份状态。 */
function tallySignals(signals: ReadonlyMap<string, SignalAccumulator>): SignalTallies {
  const tallies: SignalTallies = { sources: new Map(), threads: new Map() }
  for (const signal of signals.values()) {
    if (signal.sourceId === undefined) continue
    const sourceTally = tallies.sources.get(signal.sourceId) ?? emptyTally()
    addToTally(sourceTally, signal)
    tallies.sources.set(signal.sourceId, sourceTally)

    if (signal.threadId !== undefined) {
      const byThread = tallies.threads.get(signal.sourceId) ?? new Map<string, SourceTally>()
      const threadTally = byThread.get(signal.threadId) ?? emptyTally()
      addToTally(threadTally, signal)
      byThread.set(signal.threadId, threadTally)
      tallies.threads.set(signal.sourceId, byThread)
    }
  }
  return tallies
}

function emptyTally(): SourceTally {
  return { delivered: 0, filtered: 0 }
}

function addToTally(tally: SourceTally, signal: SignalAccumulator): void {
  if (signal.delivered) {
    tally.delivered += 1
    tally.lastDeliveredAt =
      tally.lastDeliveredAt === undefined
        ? signal.receivedAt
        : Math.max(tally.lastDeliveredAt, signal.receivedAt)
  } else {
    tally.filtered += 1
  }
  tally.lastEventAt =
    tally.lastEventAt === undefined ? signal.receivedAt : Math.max(tally.lastEventAt, signal.receivedAt)
}

function toSourceSnapshot(
  source: SourceAccumulator,
  tallies: SignalTallies,
): SourceSnapshot {
  const definition = source.definition
  const tally = tallies.sources.get(definition.id)
  const byThread = tallies.threads.get(definition.id)
  const view: SourceSnapshot = {
    id: definition.id,
    name: definition.name,
    enabled: definition.enabled,
    channelKind: definition.channel.kind,
    threads: definition.threads.map(thread => {
      const counted = byThread?.get(thread.id)
      const threadView: SourceSnapshot['threads'][number] = {
        id: thread.id,
        name: thread.name,
        enabled: thread.enabled,
        deliveredCount: counted?.delivered ?? 0,
        filteredCount: counted?.filtered ?? 0,
      }
      if (counted?.lastEventAt !== undefined) threadView.lastEventAt = counted.lastEventAt
      return threadView
    }),
    deliveredCount: tally?.delivered ?? 0,
    filteredCount: tally?.filtered ?? 0,
  }
  if (definition.description !== undefined) view.description = definition.description
  if (tally?.lastEventAt !== undefined) view.lastEventAt = tally.lastEventAt
  return view
}

function sourceDefinitionsOf(sources: ReadonlyMap<string, SourceAccumulator>): Map<string, SourceDefinition> {
  const definitions = new Map<string, SourceDefinition>()
  for (const [id, source] of sources) {
    if (source.removed) continue
    definitions.set(id, source.definition)
  }
  return definitions
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
