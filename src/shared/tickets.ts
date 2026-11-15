// src/shared/tickets.ts
//
// 工单视图契约。工单没有 status 字段：阶段由事件序列派生（见方案 §5.1），
// 因此这里只声明「可被观察到的阶段」与对外卡片字段。

/** 派生阶段。`blocked` 是 `running` 的副标签，不是独立胶囊（方案 §5.1）。 */
export const TICKET_STAGES = ['queued', 'running', 'blocked', 'ended'] as const

export type TicketStage = (typeof TICKET_STAGES)[number]

/** 工单结束原因。 */
export const TICKET_OUTCOMES = ['completed', 'failed'] as const

export type TicketOutcome = (typeof TICKET_OUTCOMES)[number]

/** 排队原因：入队时已知的放行阻塞条件（方案 §5.5、§11）。 */
export const QUEUE_REASONS = ['worker-busy', 'capacity-full'] as const

export type QueueReason = (typeof QUEUE_REASONS)[number]

/** 工单卡片与 HTTP 响应共用的一份视图（方案 §9.2）。 */
export interface TicketView {
  /** 账本主键：`t-<10 hex>`。 */
  id: string
  /** 展示短码：`id` 去掉前缀后的前 6 位。 */
  shortId: string
  title: string
  stage: TicketStage
  /** 仍停在待处理时给出原因；已放行时不存在。 */
  queueReason?: QueueReason
  /** 进行中但 worker 回合被中断：仍占执行槽位，等下一次唤醒继续。 */
  interrupted?: boolean
  goal: string
  /** 背景与用户原话摘录；派发简报与 P3 搜索都用它。 */
  context?: string
  /** 约束与禁止事项。 */
  constraints?: string[]
  /** 验收标准。 */
  expectedOutput?: string
  /** 放行后绑定的执行会话；待处理时不存在。 */
  workerSessionId?: string
  /** 工单工作目录；未指定时为 `<state>/work/<ticketId>`。 */
  directory?: string
  createdAt: number
  updatedAt: number
  endedAt?: number
  outcome?: TicketOutcome
  /** 结束时的汇报摘要；回合未汇报就结束时不存在。 */
  report?: string
}
