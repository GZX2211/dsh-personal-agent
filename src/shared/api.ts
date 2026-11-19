// src/shared/api.ts
//
// 同源 HTTP 契约：路径前缀、自定义请求头、健康检查与总控台快照的响应形状。
// Host 与 Client 共用，调用点不得硬编码这些字面量。

import type { ApprovalView, ApprovalDecisionKind, ApprovalTransport } from './approvals.ts'
import type { SignalView } from './signals.ts'
import type { SourceView, TimerSourceView } from './sources.ts'
import type { TicketView } from './tickets.ts'

/** 插件 HTTP 面挂载前缀；Host 以 prefix 路由注册，Client 以此为唯一网络入口。 */
export const API_PREFIX = '/personal-agent/api'

/**
 * 强制显式调用的自定义头。
 *
 * 浏览器对同源请求不加 CORS 预检，所以这个头不是安全边界，而是把「本插件的脚本」
 * 与「普通表单式跨站请求」分开的第一道可见约定；真正的边界是下面的同源校验。
 */
export const REQUEST_HEADER = 'x-personal-agent-request'
export const REQUEST_HEADER_VALUE = '1'

/** 各端点的绝对路径（含前缀）。 */
export const ROUTES = {
  health: `${API_PREFIX}/health`,
  snapshot: `${API_PREFIX}/snapshot`,
  signals: `${API_PREFIX}/signals`,
} as const

/** 审批决定端点的具体路径（带 approvalId）。 */
export function approvalDecidePath(approvalId: string): string {
  return `${API_PREFIX}/approvals/${encodeURIComponent(approvalId)}/decide`
}

/** 匹配决定端点的路径形态，捕获 approvalId。 */
export const APPROVAL_DECIDE_PATTERN = new RegExp(
  `^${API_PREFIX}/approvals/([^/]+)/decide$`,
)

/**
 * 来源操作端点：开关（可指定线程）、测试、删除。
 *
 * 三者都带 sourceId；sourceId 编码后进路径，因此它不能借斜杠改写路由。
 */
export function sourceTogglePath(sourceId: string): string {
  return `${API_PREFIX}/sources/${encodeURIComponent(sourceId)}/toggle`
}

export const SOURCE_TOGGLE_PATTERN = new RegExp(`^${API_PREFIX}/sources/([^/]+)/toggle$`)

export function sourceTestPath(sourceId: string): string {
  return `${API_PREFIX}/sources/${encodeURIComponent(sourceId)}/test`
}

export const SOURCE_TEST_PATTERN = new RegExp(`^${API_PREFIX}/sources/([^/]+)/test$`)

/** 删除没有子动作：路径就是来源本身。 */
export function sourceRemovePath(sourceId: string): string {
  return `${API_PREFIX}/sources/${encodeURIComponent(sourceId)}`
}

export const SOURCE_REMOVE_PATTERN = new RegExp(`^${API_PREFIX}/sources/([^/]+)$`)

/** 信号查询的条数范围：默认值保护轮询，上限保护一次响应的大小。 */
export const SIGNAL_QUERY_LIMIT = {
  min: 1,
  max: 500,
  default: 200,
} as const

export interface SignalQuery {
  /** 匹配 text / sourceName / threadName 的搜索文本；空白视同没有。 */
  q?: string
  /** 返回条数上限；越界时收敛到契约范围。 */
  limit?: number
}

/** 从账本全量检索信号：搜索要覆盖快照 200 条之外的历史。 */
export function signalQueryPath(query: SignalQuery = {}): string {
  const params = new URLSearchParams()
  const text = query.q?.trim()
  if (text !== undefined && text.length > 0) params.set('q', text)
  if (query.limit !== undefined) params.set('limit', String(clampLimit(query.limit)))
  const search = params.toString()
  return search.length === 0 ? ROUTES.signals : `${ROUTES.signals}?${search}`
}

function clampLimit(value: number): number {
  if (!Number.isFinite(value)) return SIGNAL_QUERY_LIMIT.default
  return Math.min(SIGNAL_QUERY_LIMIT.max, Math.max(SIGNAL_QUERY_LIMIT.min, Math.trunc(value)))
}

/** 稳定错误码：客户端按码分支，不吞错。 */
export const ERROR_CODES = {
  notFound: 'not-found',
  methodNotAllowed: 'method-not-allowed',
  wrongOrigin: 'wrong-origin',
  missingRequestHeader: 'missing-request-header',
  badRequest: 'bad-request',
  internal: 'internal',
  sourceNotFound: 'source-not-found',
  sourceInvalid: 'source-invalid',
  sourceStartFailed: 'source-start-failed',
} as const

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES]

export interface ErrorResponse {
  ok: false
  code: ErrorCode
  message: string
}

export interface HealthResponse {
  ok: true
  plugin: string
  version: string
  origin: string
  stateDir: string
  uptimeMs: number
}

/** 工单各阶段计数，`total` 是全部工单数而不是某阶段数。 */
export interface TicketStats {
  queued: number
  running: number
  blocked: number
  ended: number
  total: number
}

export interface ApprovalStats {
  pending: number
  decided: number
}

/** 信号按「是否投递」分计；`total` 是全部信号数而不是某类数。 */
export interface SignalStats {
  delivered: number
  filtered: number
  total: number
}

export interface SnapshotStats {
  tickets: TicketStats
  approvals: ApprovalStats
  signals: SignalStats
}

/**
 * 总控台一次刷新所需的全部派生状态；作废审批不出现在任何列表里。
 *
 * `signals` 只带最近 `SIGNAL_VIEW_LIMIT` 条：完整历史在账本里，检索历史走查询，
 * 而不是把整本账塞进每次轮询。
 *
 * `sources` 的运行时状态由感知服务在组装时补上；`timers` 来自官方调度器，只读。
 */
export interface SnapshotResponse {
  tickets: TicketView[]
  approvals: ApprovalView[]
  signals: SignalView[]
  sources: SourceView[]
  timers: TimerSourceView[]
  stats: SnapshotStats
  /** router 会话；来源页「在对话中创建」用它聚焦那个会话。缺省时按钮不可用。 */
  routerSessionId?: string
}

/** 一次全量信号检索的结果；`total` 是匹配总数，不受 `limit` 截断。 */
export interface SignalQueryResponse {
  signals: SignalView[]
  total: number
}

/** 来源开关：带 `threadId` 时只切那一条线程。 */
export interface SourceToggleRequest {
  enabled: boolean
  threadId?: string
}

export interface SourceToggleResponse {
  ok: true
  source: SourceView
}

/** 测试来源：`waitMs` 是 script 渠道收集输出的时间窗。 */
export interface SourceTestRequest {
  waitMs?: number
}

export interface SourceTestResponse {
  ok: true
  signals: SignalView[]
}

export interface SourceRemoveResponse {
  ok: true
  removed: boolean
}

/** 提交决定时的稳定失败码（方案 §9.4）；客户端按码给出具体文案。 */
export const DECISION_ERROR_CODES = {
  notFound: 'not-found',
  alreadyDecided: 'already-decided',
  workerArchived: 'worker-archived',
  deliveryFailed: 'delivery-failed',
  invalidDecision: 'invalid-decision',
} as const

export type DecisionErrorCode = (typeof DECISION_ERROR_CODES)[keyof typeof DECISION_ERROR_CODES]

/** 提交决定：选中一个选项、给出自定义答案或跳过。 */
export interface DecisionRequest {
  kind: ApprovalDecisionKind
  /** `selected` 必填：选项下标。 */
  index?: number
  /** `answered` 必填：人的自定义答案。 */
  answer?: string
}

export interface DecisionSuccess {
  ok: true
  transport: ApprovalTransport
}

export interface DecisionFailure {
  ok: false
  code: DecisionErrorCode
  message: string
}

export type DecisionResponse = DecisionSuccess | DecisionFailure

/**
 * 一次决定提交的完整结果：HTTP 状态由审批服务判定（200/400/404/409/502）。
 * 审批服务产出它、HTTP 面原样转成响应，所以两侧共用这一份形状。
 */
export interface DecisionOutcome {
  status: number
  body: DecisionResponse
}
