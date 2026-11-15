// src/host/console-api/guard.ts
//
// 同源与显式调用校验。端口只监听回环并不够：任何本地页面都能对回环端口发
// 简单请求，所以状态变更必须再被 Origin/Referer 与自定义头挡住。

import type { IncomingMessage } from 'node:http'
import { ERROR_CODES, REQUEST_HEADER, REQUEST_HEADER_VALUE, type ErrorCode } from '../../shared/api.ts'

export type GuardVerdict =
  | { ok: true }
  | { ok: false; code: ErrorCode; message: string }

/**
 * 桌面端渲染页的来源。Desktop 把 `dsh-app://app` 下的请求转发给本 Host 时会删掉
 * Origin 与 Sec-Fetch-Site，但保留 Referer；因此它是本该被当成「本应用页面」的来源。
 */
const DESKTOP_PAGE_ORIGIN = 'dsh-app://app'

function reject(code: ErrorCode, message: string): GuardVerdict {
  return { ok: false, code, message }
}

function isSameOrigin(origin: string, value: string): boolean {
  return value === origin || value.startsWith(`${origin}/`)
}

function isDesktopPage(value: string): boolean {
  return value === DESKTOP_PAGE_ORIGIN || value.startsWith(`${DESKTOP_PAGE_ORIGIN}/`)
}

/**
 * 判定一次请求是否来自本 GUI 页面。
 *
 * 只拒绝**明确存在**且不合格的证据；三者全缺席时放行，因为 Desktop 转发会剥离
 * Origin、Referer 与 Sec-Fetch-Site，而浏览器跨站请求必带三者之一（跨站 CORS
 * 请求带 Origin，简单请求带 Sec-Fetch-Site）。自定义头是浏览器侧的实际门槛：
 * 跨站请求带它会触发预检，而本端点不返回 CORS 头。
 *
 * @param origin - 本进程实际服务的源（`http://127.0.0.1:<port>`）。
 * @param request - 待判定的请求；只读头部，不消费 body。
 */
export function guardRequest(origin: string, request: IncomingMessage): GuardVerdict {
  if (request.headers[REQUEST_HEADER] !== REQUEST_HEADER_VALUE) {
    return reject(
      ERROR_CODES.missingRequestHeader,
      `missing ${REQUEST_HEADER}: ${REQUEST_HEADER_VALUE} header; this endpoint only accepts the Personal Agent console`,
    )
  }
  const originHeader = request.headers.origin
  if (originHeader !== undefined && !isSameOrigin(origin, originHeader)) {
    return reject(ERROR_CODES.wrongOrigin, `Origin ${originHeader} is not ${origin}`)
  }
  const referer = request.headers.referer
  if (referer !== undefined && !isSameOrigin(origin, referer) && !isDesktopPage(referer)) {
    return reject(ERROR_CODES.wrongOrigin, `Referer ${referer} is not under ${origin}`)
  }
  // 宿主页面可能配置 Referrer-Policy: no-referrer，把唯一可用的 Referer 也去掉。
  // Sec-Fetch-Site 由浏览器按真实来源强制写入、脚本不可伪造；只接受 same-origin。
  const fetchSite = request.headers['sec-fetch-site']
  if (fetchSite !== undefined && fetchSite !== 'same-origin') {
    return reject(
      ERROR_CODES.wrongOrigin,
      `Sec-Fetch-Site ${fetchSite} is not a same-origin document`,
    )
  }
  return { ok: true }
}
