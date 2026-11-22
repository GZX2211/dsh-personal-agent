// src/shared/ticket-detail.ts
//
// 工单详情页的读视图契约：一张工单的调用链、参与会话与交付对照。
//
// 链上只画两类事实：账本事件（派发/补充/审批/中断/关闭）与「有地址的主动投递」
// （一个 Agent 明确发给另一个 Agent 的消息）。工具返回、子代理完成通知是回执，
// 不是影响边，因此不进 rows。
//
// 行里只放语义枚举与内容文本，不放成品句子：措辞属于客户端词典。

import { API_PREFIX } from './api.ts'
import type { DecisionAction, SignalKind, TaskMode } from './events.ts'
import type { TicketOutcome, TicketView } from './tickets.ts'

/** 一张工单详情的绝对路径。 */
export function ticketDetailPath(ticketId: string): string {
  return `${API_PREFIX}/tickets/${encodeURIComponent(ticketId)}`
}

/** 匹配详情路径并捕获 ticketId；id 已编码，因此不会跨段。 */
export const TICKET_DETAIL_PATTERN = new RegExp(`^${API_PREFIX}/tickets/([^/]+)$`)

/** 会话日志的可用程度：读不出来不阻断整页，只降级提示。 */
export type DetailLogState = 'full' | 'partial' | 'unavailable'

/** 这张单为什么存在：来源信号 → 决定 → 派单会话。 */
export interface DetailOrigin {
  signal?: {
    kind: SignalKind
    text?: string
    sourceName?: string
    threadName?: string
    receivedAt: number
  }
  decision?: {
    action: DecisionAction
    at: number
    /** `true` 表示回合结束兜底推断，而不是处理类工具显式认领。 */
    inferred?: boolean
  }
  /** 在哪个会话里被派发（router 会话）。 */
  requestedBySessionId?: string
}

/** 泳道的一列：router 轨、人、负责人与各级子代理。 */
export interface AgentLaneView {
  /** sessionId；`router` 与 `human` 是保留值。 */
  id: string
  /** 0 = router 轨；人/负责人/子代理按 1..n。 */
  index: number
  /** 展示名：子代理名（lead/reviewer/architect…）；router 与人由客户端按角色取名。 */
  name?: string
  role: 'router' | 'human' | 'lead' | 'subagent'
  parentId?: string
  status: 'running' | 'idle' | 'blocked' | 'done' | 'stopped' | 'unknown'
  currentTurn?: number
  turns?: number
  tokens?: number
  /** 会话标题（负责人/子代理的工单标题或子代理名）。 */
  title?: string
  /** 真实会话 id；`human` 没有会话。 */
  sessionId?: string
}

/** 链行的共同字段。 */
export interface ChainRowBase {
  /** 稳定键：轮询增量时用它判断哪一行是新出现的。 */
  id: string
  at: number
  /** 这一行在会话日志里的位置；只用于展开时显示锚点。 */
  anchor?: { sessionId: string; seq?: number; turn?: number; step?: number }
}

/** 派发/追加：router 把工单交给执行会话。 */
export interface DispatchRow extends ChainRowBase {
  kind: 'dispatch'
  from: 'router'
  to: string
  mode: TaskMode
  /** 简报正文的首行摘要。 */
  summary: string
  /** 简报全文（已截断）。 */
  text?: string
}

/** 补充：router 往正在执行的工单里插一条信息。 */
export interface SupplementRow extends ChainRowBase {
  kind: 'supplement'
  from: 'router'
  to: string
  summary: string
  text: string
}

/** 派发子代理：父级把一个任务交给新建（或复用）的子会话。 */
export interface SpawnRow extends ChainRowBase {
  kind: 'spawn'
  from: string
  to: string
  summary: string
  text?: string
}

/** 投递：一个 Agent 明确发给另一个 Agent 的消息。 */
export interface HopRow extends ChainRowBase {
  kind: 'hop'
  from: string
  to: string
  /** 向下（父→子）、向上（子→父）或平级（兄弟之间）。 */
  direction: 'down' | 'up' | 'lateral'
  summary: string
  text?: string
}

/** 扇出：同一父级在短窗口内连续派发多个子代理，合并成一行。 */
export interface FanRow extends ChainRowBase {
  kind: 'fan'
  from: string
  to: { sessionId: string; summary: string }[]
}

/** 介入：用户绕过 Router 直接给执行会话发消息。只在详情视图里出现，不写账本。 */
export interface InterveneRow extends ChainRowBase {
  kind: 'intervene'
  from: 'human'
  to: string
  summary: string
  text: string
  anchor: { sessionId: string; seq?: number }
}

/** 审批：请求发给人类，决定从人类发出。 */
export interface ApprovalRow extends ChainRowBase {
  kind: 'approval'
  phase: 'request' | 'decision'
  from: string
  to: string
  /** 请求时是问题，决定时是选择/答案。 */
  summary: string
  /** 请求的问题选项（只读展示）。 */
  options?: string[]
  risk?: 'low' | 'medium' | 'high'
  decision?: 'selected' | 'answered' | 'skipped'
}

/** 里程碑：不改变拓扑、但解释「为什么停在这里」的事实。 */
export const MILESTONE_KINDS = [
  'queued',
  'queue-busy',
  'queue-capacity',
  'interrupted',
  'resumed',
  'approval-discarded',
  'closed',
  'failed',
] as const

export type MilestoneKind = (typeof MILESTONE_KINDS)[number]

export interface MilestoneRow extends ChainRowBase {
  kind: 'milestone'
  /** 发生在哪条泳道上；排队类里程碑没有执行者。 */
  lane?: string
  milestone: MilestoneKind
  /** 补充说明：结果原因、中断原因等原始事实。 */
  detail?: string
}

/** 未结束工单的等待对象。 */
export const LIVE_STATES = ['waiting-approval', 'waiting-agent', 'running'] as const

export type LiveState = (typeof LIVE_STATES)[number]

/** 一个正在运行的 Agent：绿点画在它的泳道上，文案取它的当前活动。 */
export interface LiveAgentView {
  lane: string
  /** 最近一条 assistant 文本的首行；没有文本时留空，客户端回退到轮次。 */
  activity?: string
  turn?: number
}

export interface LiveRow extends ChainRowBase {
  kind: 'live'
  lane?: string
  live: LiveState
  waitingOn?: string
  /** 正在进行的回合号。 */
  turn?: number
  /** 全部运行中 Agent；等待审批时不生成。 */
  liveAgents?: LiveAgentView[]
}

export type ChainRow =
  | DispatchRow
  | SupplementRow
  | SpawnRow
  | HopRow
  | FanRow
  | InterveneRow
  | ApprovalRow
  | MilestoneRow
  | LiveRow

/** 交付对照：这一单交回了什么、结果如何。 */
export interface TicketDeliveryView {
  report?: string
  outcome?: TicketOutcome
  reason?: string
}

/** 页面指标：全部由链与日志派生，不另存状态。 */
export interface TicketDetailMetrics {
  /** 执行会话数（不含 router 与人）。 */
  agents: number
  /** 主动投递数。 */
  hops: number
  supplements: number
  /** 最大并行派发数。 */
  parallel: number
  /** 相邻 A→B 后紧跟 B→A 的次数。 */
  pingPong: number
  turns: number
  tokens: number
  durationMs: number
}

export interface TicketDetailResponse {
  ticket: TicketView
  /** 这一单是派发还是追加；来自 task/queued.mode。 */
  mode: TaskMode
  origin: DetailOrigin
  lanes: AgentLaneView[]
  rows: ChainRow[]
  delivery: TicketDeliveryView
  metrics: TicketDetailMetrics
  completeness: { logs: DetailLogState; reason?: string }
  generatedAt: number
}
