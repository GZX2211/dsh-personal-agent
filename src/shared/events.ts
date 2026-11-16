// src/shared/events.ts
//
// L2 账本事件契约：账本是唯一事实来源，工单阶段与审批状态都由事件序列派生，
// 不存在可被改写的业务状态字段。本文件只有类型与常量，不引入任何运行时模块。

import type {
  ApprovalDecision,
  ApprovalOption,
  ApprovalRisk,
  ApprovalTransport,
} from './approvals.ts'
import type { QueueReason, TicketOutcome } from './tickets.ts'

/**
 * 事件类型枚举（方案 §3.1）。类型字面量同时是账本行里的 `type` 字段。
 *
 * `signal/received` 与 `decision/recorded` 是**预留**：类型、校验与幂等字段表都已就位，
 * 但当前版本没有写入方（router 的触发与决定尚未落账）；事件页/来源页实现时由它们
 * 承接，在那之前投影直接忽略这两类事件。
 */
export const EVENT_TYPES = {
  signalReceived: 'signal/received',
  decisionRecorded: 'decision/recorded',
  taskQueued: 'task/queued',
  taskDispatched: 'task/dispatched',
  taskInterrupted: 'task/interrupted',
  taskResumed: 'task/resumed',
  taskReported: 'task/reported',
  taskClosed: 'task/closed',
  approvalPending: 'approval/pending',
  approvalDecided: 'approval/decided',
  approvalDiscarded: 'approval/discarded',
} as const

export type EventType = (typeof EVENT_TYPES)[keyof typeof EVENT_TYPES]

export const EVENT_ACTORS = ['router', 'worker', 'human', 'system'] as const

export type EventActor = (typeof EVENT_ACTORS)[number]

/** 到达 router 的输入种类；`worker-reply` 默认被过滤，但仍会记账（方案 §4.1）。 */
export const SIGNAL_KINDS = ['user-message', 'worker-reply', 'trigger', 'timer'] as const

export type SignalKind = (typeof SIGNAL_KINDS)[number]

/** router 的处理决定（方案 §4.4）。 */
export const DECISION_ACTIONS = ['dispatch', 'append', 'reply', 'ignore'] as const

export type DecisionAction = (typeof DECISION_ACTIONS)[number]

/** 派发方式：新开执行会话，或复用旧会话追加。 */
export const TASK_MODES = ['dispatch', 'append'] as const

export type TaskMode = (typeof TASK_MODES)[number]

/** worker 回合的汇报结论；错误结束配 `failed`（方案 §11）。 */
export const REPORT_STATUSES = ['done', 'failed'] as const

export type ReportStatus = (typeof REPORT_STATUSES)[number]

/** 唯一已知的作废原因：点确认时目标 worker 会话已被归档（方案 §6.2a）。 */
export const APPROVAL_DISCARD_REASONS = ['worker-archived'] as const

export type ApprovalDiscardReason = (typeof APPROVAL_DISCARD_REASONS)[number]

/** 预留：反查 L1 会话日志的位置。 */
export interface L1Ref {
  sessionId: string
  seq: number
}

/**
 * 事件通用字段（方案 §3.2）。
 *
 * `seq`、`eventId`、`time` 由账本在 append 时分配，因此草稿类型去掉这三项：
 * 生产者只对「发生了什么」负责，不对账本的排号与时钟负责。
 */
export interface EventEnvelope<T extends EventType, P extends object> {
  seq: number
  eventId: string
  type: T
  time: number
  actor: EventActor
  /** 一次用户请求或一次工单域的串联键。 */
  correlationId: string
  /** 父事件 eventId。 */
  causationId?: string
  /** 产生该事件的会话。 */
  sessionId?: string
  /** 预留：决策权限矩阵版本。 */
  policyVersion?: string
  l1Ref?: L1Ref
  payload: P
}

/** 预留：当前版本没有写入方，见 {@link EVENT_TYPES}。 */
export interface SignalReceivedPayload {
  kind: SignalKind
  /** 是否投递给 router；被过滤的信号照样记账，只是不投递。 */
  delivered: boolean
  receivedAt: number
  sourceId?: string
  /** 外部来源的去重键；MVP 只有用户消息，因此通常不存在。 */
  externalId?: string
  text?: string
  /** 命中过滤规则时的规则 id，如 `default-silent`。 */
  rule?: string
}

/** 预留：当前版本没有写入方，见 {@link EVENT_TYPES}。 */
export interface DecisionRecordedPayload {
  action: DecisionAction
  /** `true` 表示由系统在回合结束时补记（本次触发没有路由工具调用）。 */
  inferred?: boolean
  reason?: string
  ticketId?: string
}

export interface TaskQueuedPayload {
  ticketId: string
  title: string
  goal: string
  mode: TaskMode
  /** `append` 的目标 worker 会话。 */
  workerSessionId?: string
  context?: string
  constraints?: string[]
  expectedOutput?: string
  /** 工单工作目录；缺省为 `<state>/work/<ticketId>`。 */
  directory?: string
  /** 入队时已知的放行阻塞条件；后续放行不修改此事件。 */
  queueReason?: QueueReason
  requestedBySessionId?: string
}

export interface TaskDispatchedPayload {
  ticketId: string
  workerSessionId: string
  mode: TaskMode
  directory?: string
}

/** worker 回合被中断的原因：用户停止，或进程重启后的合成收尾。 */
export const TASK_INTERRUPT_REASONS = ['turn-aborted', 'turn-interrupted'] as const

export type TaskInterruptReason = (typeof TASK_INTERRUPT_REASONS)[number]

/** 执行会话的 sessionId 走信封字段，payload 只带工单域与回合。 */
export interface TaskInterruptedPayload {
  ticketId: string
  turn: number
  reason: TaskInterruptReason
}

export interface TaskResumedPayload {
  ticketId: string
  turn: number
}

export interface TaskReportedPayload {
  ticketId: string
  summary: string
  status: ReportStatus
}

export interface TaskClosedPayload {
  ticketId: string
  outcome: TicketOutcome
  reason?: string
}

export interface ApprovalPendingPayload {
  approvalId: string
  /** 关联工单；独立审批不绑定任何工单。 */
  ticketId?: string
  question: string
  options: ApprovalOption[]
  /** worker 带上的文件，绝对路径；只读展示。 */
  attachments?: string[]
  risk?: ApprovalRisk
  requestedBySessionId: string
}

export interface ApprovalDecidedPayload {
  approvalId: string
  decision: ApprovalDecision
  decidedAt: number
  transport: ApprovalTransport
  /** `true` 表示启动自愈补写（inline 已送达但 decided 未落盘）。 */
  recovered?: boolean
}

export interface ApprovalDiscardedPayload {
  approvalId: string
  reason: ApprovalDiscardReason
  discardedAt: number
}

export type SignalReceivedEvent = EventEnvelope<typeof EVENT_TYPES.signalReceived, SignalReceivedPayload>
export type DecisionRecordedEvent = EventEnvelope<typeof EVENT_TYPES.decisionRecorded, DecisionRecordedPayload>
export type TaskQueuedEvent = EventEnvelope<typeof EVENT_TYPES.taskQueued, TaskQueuedPayload>
export type TaskDispatchedEvent = EventEnvelope<typeof EVENT_TYPES.taskDispatched, TaskDispatchedPayload>
export type TaskInterruptedEvent = EventEnvelope<typeof EVENT_TYPES.taskInterrupted, TaskInterruptedPayload>
export type TaskResumedEvent = EventEnvelope<typeof EVENT_TYPES.taskResumed, TaskResumedPayload>
export type TaskReportedEvent = EventEnvelope<typeof EVENT_TYPES.taskReported, TaskReportedPayload>
export type TaskClosedEvent = EventEnvelope<typeof EVENT_TYPES.taskClosed, TaskClosedPayload>
export type ApprovalPendingEvent = EventEnvelope<typeof EVENT_TYPES.approvalPending, ApprovalPendingPayload>
export type ApprovalDecidedEvent = EventEnvelope<typeof EVENT_TYPES.approvalDecided, ApprovalDecidedPayload>
export type ApprovalDiscardedEvent = EventEnvelope<typeof EVENT_TYPES.approvalDiscarded, ApprovalDiscardedPayload>

/** 一条已落账事件。按 `type` 收窄到对应 payload。 */
export type L2Event =
  | SignalReceivedEvent
  | DecisionRecordedEvent
  | TaskQueuedEvent
  | TaskDispatchedEvent
  | TaskInterruptedEvent
  | TaskResumedEvent
  | TaskReportedEvent
  | TaskClosedEvent
  | ApprovalPendingEvent
  | ApprovalDecidedEvent
  | ApprovalDiscardedEvent

/** 逐成员展开的 Omit：直接对联合类型用 Omit 会塌成公共字段。 */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never

/** 交给 `EventStore.append` 的事件草稿：技术字段由账本补齐。 */
export type EventDraft = DistributiveOmit<L2Event, 'seq' | 'eventId' | 'time'>
