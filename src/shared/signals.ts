// src/shared/signals.ts
//
// 事件页的读视图契约：一条信号是「一次到达 router 的输入」，它的结局由一条决定给出。
// 视图只承载展示所需的事实快照，不承载来源的运行时状态。

import type { DecisionAction, SignalKind } from './events.ts'

/**
 * 快照里最多带多少条信号。
 *
 * 上限保护的是每次轮询的快照体积，不是历史本身：更早的事实仍在账本里，
 * 需要时按查询取回，界面只负责展示这一段。
 */
export const SIGNAL_VIEW_LIMIT = 200

/** 信号的结局；`decision` 缺失表示还没有任何决定（待处理）。 */
export interface SignalDecisionView {
  action: DecisionAction
  /** dispatch / append 时关联的工单。 */
  ticketId?: string
  /** `true` 表示由回合结束兜底推断，而不是处理类工具显式认领。 */
  inferred?: boolean
  at: number
}

/** 事件页的一条卡片。 */
export interface SignalView {
  signalId: string
  kind: SignalKind
  receivedAt: number
  /** `false` 表示被来源层过滤：有记录、没有结局。 */
  delivered: boolean
  /** 被过滤时命中的规则 id。 */
  rule?: string
  sourceId?: string
  sourceName?: string
  threadId?: string
  threadName?: string
  externalId?: string
  /** 事实文本；用户消息可能因超长被截断。 */
  text: string
  messageId?: string
  decision?: SignalDecisionView
}
