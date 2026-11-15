// src/shared/api.ts
//
// 同源 HTTP 契约：路径前缀、自定义请求头、健康检查与开发期冒烟的响应形状。
// Host 与 Client 共用，调用点不得硬编码这些字面量。

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
  devState: `${API_PREFIX}/dev/state`,
  devBeacon: `${API_PREFIX}/dev/beacon`,
  devP0: `${API_PREFIX}/dev/p0`,
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

/** 浏览器侧上报的一条开发期事实，用于在无浏览器控制时确认面板真的挂载了。 */
export interface BeaconRecord {
  at: number
  event: string
  detail?: unknown
}

/**
 * 一次请求的观测记录（开发期诊断）。
 *
 * 没有浏览器控制时，"浏览器到底发了什么" 只能靠服务端自己记下来：同源守卫的
 * 每个拒绝分支都对应一个真实的、难以猜测的客户端差异。
 */
export interface ObservedRequest {
  at: number
  method: string
  path: string
  host?: string
  origin?: string
  referer?: string
  requestHeader?: string
  /** 分派结论：`ok` / `health` / 具体错误码。 */
  verdict: string
  status: number
}

/** 开发期冒烟的一步结果；失败不影响后续步骤，便于一次调用看到全部通道。 */
export interface SmokeStep {
  name: string
  ok: boolean
  detail?: unknown
  error?: string
}

export interface SmokeReport {
  ranAt: number
  takenMs: number
  steps: SmokeStep[]
}
