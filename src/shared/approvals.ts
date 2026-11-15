// src/shared/approvals.ts
//
// 审批视图契约。审批只有两态（待审批 / 已通过），作废条目从所有对外列表剔除，
// 所以这里既不声明状态枚举，也不声明作废态（方案 §6.1、§9.2）。
//
// 人的回答只有两种：选一个选项，或跳过；自由文本回答落在 `note`。
// 附件由 worker 在提交审批时给出（人只读），因此它是审批的输入事实而不是决定。

/** 人的决定种类：选中一个选项，或跳过让 worker 自行决定。 */
export const APPROVAL_DECISION_KINDS = ['selected', 'skipped'] as const

export type ApprovalDecisionKind = (typeof APPROVAL_DECISION_KINDS)[number]

/** 决定如何送达 worker：本次会话内 resolve，或重启后以 follow-up 投递。 */
export const APPROVAL_TRANSPORTS = ['inline', 'followup'] as const

export type ApprovalTransport = (typeof APPROVAL_TRANSPORTS)[number]

export const APPROVAL_RISKS = ['low', 'medium', 'high'] as const

export type ApprovalRisk = (typeof APPROVAL_RISKS)[number]

/** 一个可选项：标签要短，说明负责讲清后果。 */
export interface ApprovalOption {
  label: string
  description: string
}

/** 人提交的决定本体；送达方式在送达后由账本补上。 */
export interface ApprovalDecision {
  kind: ApprovalDecisionKind
  /** `selected` 时的选项下标；`skipped` 时为 undefined。 */
  index?: number
  /** `selected` 时选中项标签的副本：选项文案后续变化不影响历史记录。 */
  label?: string
  /** 「输入你的答案」里的自由文本。 */
  note?: string
}

/** 已写进账本的决定：落账时已确定送达方式。 */
export interface RecordedApprovalDecision extends ApprovalDecision {
  transport: ApprovalTransport
}

/** 审批卡片与 HTTP 响应共用的一份视图。 */
export interface ApprovalView {
  id: string
  /** 发起这个审批时关联的工单；独立审批没有工单。 */
  ticketId?: string
  question: string
  options: ApprovalOption[]
  /**
   * worker 随审批带上的文件，绝对路径；点击在右侧栏打开。
   * 为空时卡片不渲染附件行——「未填不显示该项」。
   */
  attachments?: string[]
  risk?: ApprovalRisk
  /** 提交该审批的 worker 会话。 */
  requestedBySessionId: string
  createdAt: number
  /** 已通过时存在；待审批时不存在——视图不额外维护状态字段。 */
  decidedAt?: number
  decision?: RecordedApprovalDecision
}
