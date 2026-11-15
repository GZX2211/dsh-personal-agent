// src/host/console-api/server.ts
//
// 同源 HTTP 面的路由器：一个 Node 请求进，一个 JSON 响应出。
// 只做协议层工作（路径分派、body 读取、状态码、请求观测），业务在各自 handler 里。

import type { IncomingMessage, ServerResponse } from 'node:http'
import {
  ERROR_CODES,
  REQUEST_HEADER,
  ROUTES,
  type ErrorResponse,
  type HealthResponse,
  type ObservedRequest,
} from '../../shared/api.ts'
import type { SmokeSuite } from '../dev/smoke.ts'
import { guardRequest } from './guard.ts'

export interface ConsoleTarget {
  plugin: string
  version: string
  origin: string
  stateDir: string
  startedAt: number
  smoke: SmokeSuite
}

/** 把 HTTP 面挂到 prefix 路由上的处理函数。 */
export function createConsoleHandler(
  target: ConsoleTarget,
): (request: IncomingMessage, response: ServerResponse) => Promise<void> {
  return async (request, response) => {
    const observed: ObservedRequest = {
      at: Date.now(),
      method: request.method ?? 'GET',
      path: '/',
      verdict: 'ok',
      status: 0,
    }
    try {
      await dispatch(target, request, response, observed)
    } catch (error) {
      observed.verdict = ERROR_CODES.internal
      sendJson(response, 500, failure(ERROR_CODES.internal, error instanceof Error ? error.message : String(error)))
    } finally {
      // 观测是开发期诊断（P0）；请求记录不参与任何业务判定。
      target.smoke.recordRequest(observed)
    }
  }
}

async function dispatch(
  target: ConsoleTarget,
  request: IncomingMessage,
  response: ServerResponse,
  observed: ObservedRequest,
): Promise<void> {
  const path = new URL(request.url ?? '/', target.origin).pathname
  const method = request.method ?? 'GET'
  observed.path = path
  observed.host = header(request, 'host')
  observed.origin = header(request, 'origin')
  observed.referer = header(request, 'referer')
  observed.requestHeader = header(request, REQUEST_HEADER)

  // 健康检查刻意不校验来者：它只回答「插件活着、状态目录在哪」，不需要授权。
  // 状态与决定类端点一律要求同源 + 自定义头。
  if (path === ROUTES.health) {
    if (method !== 'GET' && method !== 'HEAD') {
      observed.verdict = ERROR_CODES.methodNotAllowed
      return sendMethodNotAllowed(response, observed, 'GET, HEAD')
    }
    observed.verdict = 'health'
    const health: HealthResponse = {
      ok: true,
      plugin: target.plugin,
      version: target.version,
      origin: target.origin,
      stateDir: target.stateDir,
      uptimeMs: Date.now() - target.startedAt,
    }
    return sendJson(response, 200, health, observed)
  }

  const verdict = guardRequest(target.origin, request)
  if (!verdict.ok) {
    observed.verdict = verdict.code
    return sendJson(response, 403, failure(verdict.code, verdict.message), observed)
  }

  if (path === ROUTES.devState) {
    if (method !== 'GET') return sendMethodNotAllowed(response, observed, 'GET')
    return sendJson(response, 200, target.smoke.state(), observed)
  }
  if (path === ROUTES.devBeacon) {
    if (method !== 'POST') return sendMethodNotAllowed(response, observed, 'POST')
    const body = await readJson(request)
    const event = typeof body?.event === 'string' ? body.event : undefined
    if (event === undefined) {
      observed.verdict = ERROR_CODES.badRequest
      return sendJson(response, 400, failure(ERROR_CODES.badRequest, 'body.event must be a string'), observed)
    }
    target.smoke.beacon(event, body?.detail)
    return sendJson(response, 200, { ok: true }, observed)
  }
  if (path === ROUTES.devP0) {
    if (method !== 'POST') return sendMethodNotAllowed(response, observed, 'POST')
    return sendJson(response, 200, await target.smoke.runP0(), observed)
  }
  observed.verdict = ERROR_CODES.notFound
  return sendJson(response, 404, failure(ERROR_CODES.notFound, `no route for ${path}`), observed)
}

function header(request: IncomingMessage, name: string): string | undefined {
  const value = request.headers[name]
  return Array.isArray(value) ? value.join(', ') : value
}

function failure(code: ErrorResponse['code'], message: string): ErrorResponse {
  return { ok: false, code, message }
}

function sendMethodNotAllowed(response: ServerResponse, observed: ObservedRequest, allow: string): void {
  response.setHeader('allow', allow)
  sendJson(response, 405, failure(ERROR_CODES.methodNotAllowed, `only ${allow} is allowed`), observed)
}

function sendJson(response: ServerResponse, status: number, value: unknown, observed?: ObservedRequest): void {
  const body = Buffer.from(JSON.stringify(value), 'utf8')
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': String(body.byteLength),
    'cache-control': 'no-store',
  })
  response.end(body)
  if (observed !== undefined) observed.status = status
}

/** 读取 JSON body；上限与 schema 校验交给各 handler，这里只负责不撑爆内存。 */
async function readJson(request: IncomingMessage): Promise<Record<string, unknown> | undefined> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of request) {
    const buffer = chunk as Buffer
    size += buffer.byteLength
    if (size > 64 * 1024) throw new Error('request body exceeds 64 KiB')
    chunks.push(buffer)
  }
  const text = Buffer.concat(chunks).toString('utf8').trim()
  if (text.length === 0) return {}
  const parsed: unknown = JSON.parse(text)
  return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : undefined
}
