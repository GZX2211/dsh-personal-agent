// src/host/console-api/guard.ts
//
// 同源与显式调用校验。端口只监听回环并不够：任何本地页面都能对回环端口发
// 简单请求，所以状态变更必须再被 Origin/Referer 与自定义头挡住。

import type { IncomingMessage } from 'node:http'
import { ERROR_CODES, REQUEST_HEADER, REQUEST_HEADER_VALUE, type ErrorCode } from '../../shared/api.ts'

export type GuardVerdict =
  | { ok: true }
  | { ok: false; code: ErrorCode; message: string }

function reject(code: ErrorCode, message: string): GuardVerdict {
  return { ok: false, code, message }
}

/**
 * 判定一次请求是否来自本 GUI 页面。
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
  if (originHeader !== undefined) {
    return originHeader === origin
      ? { ok: true }
      : reject(ERROR_CODES.wrongOrigin, `Origin ${originHeader} is not ${origin}`)
  }
  // 同源 GET 的 fetch 不发送 Origin，只发送 Referer；两者都缺席即无法证明同源。
  const referer = request.headers.referer
  if (referer !== undefined) {
    return referer === origin || referer.startsWith(`${origin}/`)
      ? { ok: true }
      : reject(ERROR_CODES.wrongOrigin, `Referer ${referer} is not under ${origin}`)
  }
  return reject(ERROR_CODES.wrongOrigin, 'request carries neither Origin nor Referer')
}
