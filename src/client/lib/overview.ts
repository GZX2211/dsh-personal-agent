// src/client/lib/overview.ts
//
// 概览页的全部派生逻辑：上下文阈值、脉搏、注意力、Worker 舰队、今日与底栏。
// 输入即全部事实（snapshot + now），不读环境、不读网络；组件只负责渲染。

import type { ApprovalRisk } from '../../shared/approvals.ts'
import type { SnapshotResponse } from '../../shared/api.ts'
import type { WorkerContextUsage, WorkerRuntimeView } from '../../shared/runtime.ts'
import { MAX_WORKERS } from '../../shared/settings.ts'
import type { TicketView } from '../../shared/tickets.ts'

/** 标称窗口打八折作为有效容量：官方标称的 1M 经常达不到，给长回合留安全边界。 */
export const CONTEXT_WINDOW_DISCOUNT = 0.8
export const CONTEXT_WARN_RATIO = 0.6
export const CONTEXT_CRITICAL_RATIO = 0.8

export type ContextLevel = 'normal' | 'warn' | 'critical' | 'unknown'

export interface ContextMeterView {
  usedTokens: number
  windowTokens?: number
  effectiveWindow?: number
  ratio?: number
  level: ContextLevel
}

export function contextMeterOf(context?: WorkerContextUsage): ContextMeterView | undefined {
  if (context === undefined) return undefined
  const windowTokens = context.windowTokens
  // 路由没报告窗口（或报告了不可用的值）时不编造比例，界面只展示已用 token。
  if (windowTokens === undefined || !Number.isFinite(windowTokens) || windowTokens <= 0) {
    return { usedTokens: context.usedTokens, level: 'unknown' }
  }
  const effectiveWindow = Math.max(1, Math.floor(windowTokens * CONTEXT_WINDOW_DISCOUNT))
  const ratio = context.usedTokens / effectiveWindow
  const level: ContextLevel =
    ratio >= CONTEXT_CRITICAL_RATIO ? 'critical' : ratio >= CONTEXT_WARN_RATIO ? 'warn' : 'normal'
  return { usedTokens: context.usedTokens, windowTokens, effectiveWindow, ratio, level }
}

/** 显示百分比向下取整，避免 59.9% 显示成 60% 却不标黄。 */
export function contextPercent(ratio: number): number {
  return Math.floor(ratio * 100)
}

export interface PulseView {
  state: 'running' | 'sensing' | 'idle' | 'no-router'
  lastActivityAt?: number
  clickable: boolean
}

export function pulseOf(snapshot: SnapshotResponse): PulseView {
  const clickable = snapshot.routerSessionId !== undefined
  const state: PulseView['state'] =
    !clickable
      ? 'no-router'
      : snapshot.stats.tickets.running + snapshot.stats.tickets.blocked > 0
        ? 'running'
        : snapshot.sources.some(source => source.status === 'running')
          ? 'sensing'
          : 'idle'

  let lastActivityAt: number | undefined
  const consider = (at: number | undefined): void => {
    if (at !== undefined && (lastActivityAt === undefined || at > lastActivityAt)) lastActivityAt = at
  }
  for (const signal of snapshot.signals) consider(signal.receivedAt)
  for (const ticket of snapshot.tickets) consider(ticket.updatedAt)
  for (const approval of snapshot.approvals) {
    consider(approval.createdAt)
    consider(approval.decidedAt)
  }
  for (const worker of snapshot.workers ?? []) consider(worker.lastActivityAt)

  return {
    state,
    ...(lastActivityAt === undefined ? {} : { lastActivityAt }),
    clickable,
  }
}

export type AttentionTarget =
  | { kind: 'tab'; tab: 'approvals' | 'tickets' | 'sources' }
  | { kind: 'session'; sessionId: string }

export type AttentionKind =
  | 'approval'
  | 'source-error'
  | 'worker-offline'
  | 'worker-interrupted'
  | 'context-critical'

export interface AttentionItem {
  id: string
  kind: AttentionKind
  severity: 'warning' | 'danger'
  count: number
  target: AttentionTarget
  oldestAt?: number
  risk?: ApprovalRisk
  blockedCount?: number
}

export function attentionOf(snapshot: SnapshotResponse, now: number): AttentionItem[] {
  const items: AttentionItem[] = []
  const pending = snapshot.approvals.filter(approval => approval.decidedAt === undefined)

  if (pending.length > 0) {
    const risk = highestRisk(pending)
    items.push({
      id: 'approval',
      kind: 'approval',
      severity: 'warning',
      count: pending.length,
      target: { kind: 'tab', tab: 'approvals' },
      oldestAt: Math.min(...pending.map(approval => approval.createdAt)),
      ...(risk === undefined ? {} : { risk }),
      blockedCount: snapshot.stats.tickets.blocked,
    })
  }

  const fleet = fleetOf(snapshot, now)
  const offline = fleet.rows.filter(row => row.offline)
  if (offline.length > 0) {
    items.push({
      id: 'worker-offline',
      kind: 'worker-offline',
      severity: 'danger',
      count: offline.length,
      target: { kind: 'tab', tab: 'tickets' },
    })
  }

  const failing = snapshot.sources.filter(source => source.status === 'error')
  if (failing.length > 0) {
    items.push({
      id: 'source-error',
      kind: 'source-error',
      severity: 'warning',
      count: failing.length,
      target: { kind: 'tab', tab: 'sources' },
    })
  }

  // 同一张工单 offline 与 interrupted 同时出现时只算 offline；blocked 行即使
  // 会话已离线也不会带 interrupted，因为它只在 running 阶段产生。
  const interrupted = fleet.rows.filter(row => row.ticket.interrupted === true && !row.offline)
  if (interrupted.length > 0) {
    items.push({
      id: 'worker-interrupted',
      kind: 'worker-interrupted',
      severity: 'warning',
      count: interrupted.length,
      target: { kind: 'tab', tab: 'tickets' },
    })
  }

  const critical = fleet.rows.filter(row => row.context?.level === 'critical')
  if (critical.length > 0) {
    const only = critical.length === 1 ? critical[0] : undefined
    const target: AttentionTarget =
      only?.runtime === undefined
        ? { kind: 'tab', tab: 'tickets' }
        : { kind: 'session', sessionId: only.runtime.workerSessionId }
    items.push({
      id: 'context-critical',
      kind: 'context-critical',
      severity: 'danger',
      count: critical.length,
      target,
    })
  }

  return items
}

function highestRisk(approvals: readonly { risk?: ApprovalRisk }[]): ApprovalRisk | undefined {
  const rank: Record<ApprovalRisk, number> = { low: 1, medium: 2, high: 3 }
  let highest: ApprovalRisk | undefined
  for (const approval of approvals) {
    if (approval.risk === undefined) continue
    if (highest === undefined || rank[approval.risk] > rank[highest]) highest = approval.risk
  }
  return highest
}

export type WorkerDisplayStatus =
  | 'waiting'
  | 'running'
  | 'starting'
  | 'interrupted'
  | 'offline'
  | 'idle'
  | 'unknown'

export interface WorkerRow {
  ticket: TicketView
  /** 行对应的执行会话（工单视图保证非空）。 */
  workerSessionId: string
  runtime?: WorkerRuntimeView
  status: WorkerDisplayStatus
  /** 独立于展示状态：该会话是否没有活 Agent（含 blocked 但会话已离线）。 */
  offline: boolean
  context?: ContextMeterView
  turn: number
  elapsedMs: number
  waitingMs?: number
  lastActivityAt?: number
}

export interface FleetView {
  rows: WorkerRow[]
  occupied: number
  running: number
  blocked: number
  maxWorkers: number
  queued: number
}

const STATUS_ORDER: Record<WorkerDisplayStatus, number> = {
  waiting: 0,
  running: 1,
  starting: 2,
  interrupted: 3,
  offline: 4,
  idle: 5,
  unknown: 6,
}

export function fleetOf(snapshot: SnapshotResponse, now: number): FleetView {
  const workers = snapshot.workers
  const runtimeByTicket = new Map<string, WorkerRuntimeView>(
    (workers ?? []).map(worker => [worker.ticketId, worker]),
  )

  const rows: WorkerRow[] = snapshot.tickets
    // 只算已派发的工单：append 工单在排队时已经带 workerSessionId，但它还没开始执行。
    .filter(ticket => (ticket.stage === 'running' || ticket.stage === 'blocked') && ticket.workerSessionId !== undefined)
    .map(ticket => {
      const runtime = workers === undefined ? undefined : runtimeByTicket.get(ticket.id)
      const offline = workers !== undefined && (runtime === undefined || runtime.live === 'offline')
      const status = displayStatusOf(ticket, runtime, offline, workers !== undefined)
      const context =
        offline || status === 'unknown' ? undefined : contextMeterOf(runtime?.context)
      const lastActivityAt = runtime?.lastActivityAt ?? ticket.updatedAt
      const waitingMs =
        status === 'waiting' ? waitingSince(snapshot, ticket, now) : undefined
      const row: WorkerRow = {
        ticket,
        workerSessionId: ticket.workerSessionId as string,
        status,
        offline,
        turn: runtime?.turn ?? 0,
        elapsedMs: Math.max(0, now - (ticket.dispatchedAt ?? ticket.createdAt)),
        lastActivityAt,
      }
      if (runtime !== undefined) row.runtime = runtime
      if (context !== undefined) row.context = context
      if (waitingMs !== undefined) row.waitingMs = waitingMs
      return row
    })
    .sort((left, right) => {
      const byStatus = STATUS_ORDER[left.status] - STATUS_ORDER[right.status]
      if (byStatus !== 0) return byStatus
      const byActivity = (right.lastActivityAt ?? 0) - (left.lastActivityAt ?? 0)
      if (byActivity !== 0) return byActivity
      return (right.ticket.dispatchedAt ?? 0) - (left.ticket.dispatchedAt ?? 0)
    })

  return {
    rows,
    occupied: snapshot.stats.tickets.running + snapshot.stats.tickets.blocked,
    running: snapshot.stats.tickets.running,
    blocked: snapshot.stats.tickets.blocked,
    maxWorkers: snapshot.capacity?.maxWorkers ?? MAX_WORKERS.defaultValue,
    queued: snapshot.stats.tickets.queued,
  }
}

function displayStatusOf(
  ticket: TicketView,
  runtime: WorkerRuntimeView | undefined,
  offline: boolean,
  workersReported: boolean,
): WorkerDisplayStatus {
  if (ticket.stage === 'blocked') return 'waiting'
  if (ticket.stage === 'running' && ticket.interrupted === true) return 'interrupted'
  if (offline) return 'offline'
  // 旧快照没有 workers 字段：不谎报运行中，也不猜测离线。
  if (!workersReported || runtime === undefined) return 'unknown'
  if (runtime.turn === 0) return 'starting'
  return runtime.live === 'running' ? 'running' : 'idle'
}

function waitingSince(snapshot: SnapshotResponse, ticket: TicketView, now: number): number | undefined {
  let oldest: number | undefined
  for (const approval of snapshot.approvals) {
    if (approval.ticketId !== ticket.id || approval.decidedAt !== undefined) continue
    if (oldest === undefined || approval.createdAt < oldest) oldest = approval.createdAt
  }
  return oldest === undefined ? undefined : Math.max(0, now - oldest)
}

export interface TodayView {
  start: number
  approvalsDecided: number
  approvalsPending: number
  ticketsCompleted: number
  ticketsFailed: number
  averageTicketMs?: number
  signals?: { delivered: number; filtered: number; total: number }
}

export function todayOf(snapshot: SnapshotResponse, now: number): TodayView {
  const start = snapshot.activity?.today.start ?? localDayStart(now)

  let approvalsDecided = 0
  for (const approval of snapshot.approvals) {
    if (approval.decidedAt !== undefined && approval.decidedAt >= start) approvalsDecided += 1
  }

  let ticketsCompleted = 0
  let ticketsFailed = 0
  let totalMs = 0
  let endedCount = 0
  for (const ticket of snapshot.tickets) {
    if (ticket.endedAt === undefined || ticket.endedAt < start) continue
    if (ticket.outcome === 'completed') ticketsCompleted += 1
    else if (ticket.outcome === 'failed') ticketsFailed += 1
    totalMs += Math.max(0, ticket.endedAt - ticket.createdAt)
    endedCount += 1
  }

  const today: TodayView = {
    start,
    approvalsDecided,
    approvalsPending: snapshot.stats.approvals.pending,
    ticketsCompleted,
    ticketsFailed,
  }
  if (endedCount > 0) today.averageTicketMs = Math.round(totalMs / endedCount)
  const activity = snapshot.activity?.today
  if (activity !== undefined) {
    today.signals = {
      delivered: activity.delivered,
      filtered: activity.filtered,
      total: activity.delivered + activity.filtered,
    }
  }
  return today
}

/** 活动索引缺失时的降级：只用于今日过滤，正常情况以 Host 的 activity.today.start 为准。 */
function localDayStart(time: number): number {
  const date = new Date(time)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

export interface FooterView {
  tickets: number
  approvals: number
  signals: number
  sourcesRunning: number
  sourcesError: number
  timers: number
}

export function footerOf(snapshot: SnapshotResponse): FooterView {
  return {
    tickets: snapshot.stats.tickets.total,
    approvals: snapshot.stats.approvals.pending + snapshot.stats.approvals.decided,
    signals: snapshot.stats.signals.total,
    sourcesRunning: snapshot.sources.filter(source => source.status === 'running').length,
    sourcesError: snapshot.sources.filter(source => source.status === 'error').length,
    timers: snapshot.timers.filter(timer => timer.active).length,
  }
}

export function isFreshEmpty(snapshot: SnapshotResponse): boolean {
  return (
    snapshot.tickets.length === 0 &&
    snapshot.approvals.length === 0 &&
    snapshot.signals.length === 0 &&
    snapshot.sources.length === 0 &&
    snapshot.timers.length === 0
  )
}
