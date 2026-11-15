// src/shared/api.ts
//
// 同源 HTTP 契约：路径前缀、自定义请求头、健康检查与总控台快照的响应形状。
// Host 与 Client 共用，调用点不得硬编码这些字面量。

import type { ApprovalView } from './approvals.ts'
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
} as const

/** 稳定错误码：客户端按码分支，不吞错。 */
export const ERROR_CODES = {
  notFound: 'not-found',
  methodNotAllowed: 'method-not-allowed',
  wrongOrigin: 'wrong-origin',
  missingRequestHeader: 'missing-request-header',
  badRequest: 'bad-request',
  internal: 'internal',
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

export interface SnapshotStats {
  tickets: TicketStats
  approvals: ApprovalStats
}

/** 总控台一次刷新所需的全部派生状态；作废审批不出现在任何列表里。 */
export interface SnapshotResponse {
  tickets: TicketView[]
  approvals: ApprovalView[]
  stats: SnapshotStats
}
