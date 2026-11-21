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
import type { SourceDefinition } from './sources.ts'
import type { QueueReason, TicketOutcome } from './tickets.ts'

/**
 * 事件类型枚举（方案 §3.1）。类型字面量同时是账本行里的 `type` 字段。
 *
 * `signal/received` 记录一次到达 router 的输入，`decision/recorded` 记录它的处理结局；
 * 一条决定对应一个信号，两者用同一个 `correlationId`（即 signalId）串联。
 */
export const EVENT_TYPES = {
  signalReceived: 'signal/received',
  decisionRecorded: 'decision/recorded',
  sourceCreated: 'source/created',
  sourceUpdated: 'source/updated',
  sourceRemoved: 'source/removed',
  taskQueued: 'task/queued',
  taskDispatched: 'task/dispatched',
  taskInterrupted: 'task/interrupted',
  taskResumed: 'task/resumed',
  taskSupplemented: 'task/supplemented',
  taskReported: 'task/reported',
  taskClosed: 'task/closed',
  approvalPending: 'approval/pending',
  approvalDecided: 'approval/decided',
  approvalDiscarded: 'approval/discarded',
} as const

export type EventType = (typeof EVENT_TYPES)[keyof typeof EVENT_TYPES]

export const EVENT_ACTORS = ['router', 'worker', 'human', 'system'] as const

export type EventActor = (typeof EVENT_ACTORS)[number]

/** 到达 router 的输入种类：用户消息、定时事件、感知事件（方案 §2）。 */
export const SIGNAL_KINDS = ['user-message', 'timer', 'perception'] as const

export type SignalKind = (typeof SIGNAL_KINDS)[number]

/**
 * router 的处理决定（方案 §2）。
 *
 * 没有 `ignore`：被忽略的输入在来源层就只记 `delivered:false`，不进入处理环节，
 * 因此也不存在「忽略」这个结算动作。
 *
 * `supplement` 不建工单：它把一条信息插进正在执行的工单，送达方式因此固定为
 * `steer`；followup 会起一个不属于任何工单的新回合。
 */
export const DECISION_ACTIONS = ['dispatch', 'append', 'supplement', 'reply'] as const

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

/**
 * 一次到达 router 的输入。
 *
 * `signalId` 是信号的自身身份，同时决定账本幂等：同一条消息无论被观察多少次，
 * 都只能入账一次。
 */
export interface SignalReceivedPayload {
  kind: SignalKind
  /** 是否投递给 router；被来源层过滤的信号照样记账，只是不投递。 */
  delivered: boolean
  receivedAt: number
  signalId: string
  /** 感知来源 id；定时事件为官方 schedule id；用户消息不存在。 */
  sourceId?: string
  /** 来源名称快照：来源可能在之后被删，历史记录要能解释自己从哪里来。 */
  sourceName?: string
  threadId?: string
  threadName?: string
  /** 来源侧去重键（感知事件）。 */
  externalId?: string
  /** 事实陈述（感知）、提醒正文（定时）或用户消息摘要。 */
  text?: string
  /** 被过滤时命中的规则 id：`match` / `min-gap` / `no-change`。 */
  rule?: string
  /** 已投递时 router 会话里的消息 id，用于 L1 反查与认领关联。 */
  messageId?: string
}

/** router 对一条信号的处理结局。 */
export interface DecisionRecordedPayload {
  action: DecisionAction
  /** 一条决定对应一个信号。 */
  signalId: string
  /** dispatch / append 时关联的工单。 */
  ticketId?: string
  /** `true` 表示回合结束兜底推断：该信号没有触发任何处理类工具。 */
  inferred?: boolean
  reason?: string
}

/** `source/updated` 同时承载定义变更、来源开关与线程开关：投影只折叠最后一条。 */
export interface SourceCreatedPayload {
  sourceId: string
  definition: SourceDefinition
}

export interface SourceUpdatedPayload {
  sourceId: string
  definition: SourceDefinition
}

export interface SourceRemovedPayload {
  sourceId: string
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

/**
 * router 向正在执行的工单补充了一条信息：不是新任务，因此不建工单。
 *
 * `targetSessionId` 是接收方（当前 worker），`requestedBySessionId` 是派单方，
 * 两者都是事实快照：会话之后可能被归档，链上仍要能解释这条信息从哪里来。
 */
export interface TaskSupplementedPayload {
  ticketId: string
  targetSessionId: string
  text: string
  requestedBySessionId: string
  /** 已送达消息的 id；投递失败时不存在，链上因此只能画账本事实。 */
  messageId?: string
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
export type SourceCreatedEvent = EventEnvelope<typeof EVENT_TYPES.sourceCreated, SourceCreatedPayload>
export type SourceUpdatedEvent = EventEnvelope<typeof EVENT_TYPES.sourceUpdated, SourceUpdatedPayload>
export type SourceRemovedEvent = EventEnvelope<typeof EVENT_TYPES.sourceRemoved, SourceRemovedPayload>
export type TaskQueuedEvent = EventEnvelope<typeof EVENT_TYPES.taskQueued, TaskQueuedPayload>
export type TaskDispatchedEvent = EventEnvelope<typeof EVENT_TYPES.taskDispatched, TaskDispatchedPayload>
export type TaskInterruptedEvent = EventEnvelope<typeof EVENT_TYPES.taskInterrupted, TaskInterruptedPayload>
export type TaskResumedEvent = EventEnvelope<typeof EVENT_TYPES.taskResumed, TaskResumedPayload>
export type TaskSupplementedEvent = EventEnvelope<typeof EVENT_TYPES.taskSupplemented, TaskSupplementedPayload>
export type TaskReportedEvent = EventEnvelope<typeof EVENT_TYPES.taskReported, TaskReportedPayload>
export type TaskClosedEvent = EventEnvelope<typeof EVENT_TYPES.taskClosed, TaskClosedPayload>
export type ApprovalPendingEvent = EventEnvelope<typeof EVENT_TYPES.approvalPending, ApprovalPendingPayload>
export type ApprovalDecidedEvent = EventEnvelope<typeof EVENT_TYPES.approvalDecided, ApprovalDecidedPayload>
export type ApprovalDiscardedEvent = EventEnvelope<typeof EVENT_TYPES.approvalDiscarded, ApprovalDiscardedPayload>

/** 一条已落账事件。按 `type` 收窄到对应 payload。 */
export type L2Event =
  | SignalReceivedEvent
  | DecisionRecordedEvent
  | SourceCreatedEvent
  | SourceUpdatedEvent
  | SourceRemovedEvent
  | TaskQueuedEvent
  | TaskDispatchedEvent
  | TaskInterruptedEvent
  | TaskResumedEvent
  | TaskSupplementedEvent
  | TaskReportedEvent
  | TaskClosedEvent
  | ApprovalPendingEvent
  | ApprovalDecidedEvent
  | ApprovalDiscardedEvent

/** 逐成员展开的 Omit：直接对联合类型用 Omit 会塌成公共字段。 */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never

/** 交给 `EventStore.append` 的事件草稿：技术字段由账本补齐。 */
export type EventDraft = DistributiveOmit<L2Event, 'seq' | 'eventId' | 'time'>
