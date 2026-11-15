// src/host/console-api/server.ts
//
// 同源 HTTP 面的路由器：一个 Node 请求进，一个 JSON 响应出。
// 只做协议层工作（路径分派、同源守卫、状态码），数据由注入的 snapshot 提供。

import type { IncomingMessage, ServerResponse } from 'node:http'
import {
  ERROR_CODES,
  ROUTES,
  type ErrorResponse,
  type HealthResponse,
  type SnapshotResponse,
} from '../../shared/api.ts'
import { guardRequest } from './guard.ts'

export interface ConsoleTarget {
  plugin: string
  version: string
  origin: string
  stateDir: string
  startedAt: number
  /** 读一次总控台视图；账本不可用时抛错，由路由转成 internal 而不是空快照。 */
  snapshot: () => Promise<SnapshotResponse> | SnapshotResponse
}

/** 把 HTTP 面挂到 prefix 路由上的处理函数。 */
export function createConsoleHandler(
  target: ConsoleTarget,
): (request: IncomingMessage, response: ServerResponse) => Promise<void> {
  return async (request, response) => {
    try {
      await dispatch(target, request, response)
    } catch (error) {
      sendJson(response, 500, failure(ERROR_CODES.internal, error instanceof Error ? error.message : String(error)))
    }
  }
}

async function dispatch(
  target: ConsoleTarget,
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const path = new URL(request.url ?? '/', target.origin).pathname
  const method = request.method ?? 'GET'

  // 健康检查刻意不校验来者：它只回答「插件活着、状态目录在哪」，不需要授权。
  // 状态类端点一律要求同源 + 自定义头。
  if (path === ROUTES.health) {
    if (method !== 'GET' && method !== 'HEAD') {
      return sendMethodNotAllowed(response, 'GET, HEAD')
    }
    const health: HealthResponse = {
      ok: true,
      plugin: target.plugin,
      version: target.version,
      origin: target.origin,
      stateDir: target.stateDir,
      uptimeMs: Date.now() - target.startedAt,
    }
    return sendJson(response, 200, health)
  }

  const verdict = guardRequest(target.origin, request)
  if (!verdict.ok) return sendJson(response, 403, failure(verdict.code, verdict.message))

  if (path === ROUTES.snapshot) {
    if (method !== 'GET') return sendMethodNotAllowed(response, 'GET')
    return sendJson(response, 200, await target.snapshot())
  }

  return sendJson(response, 404, failure(ERROR_CODES.notFound, `no route for ${path}`))
}

function failure(code: ErrorResponse['code'], message: string): ErrorResponse {
  return { ok: false, code, message }
}

function sendMethodNotAllowed(response: ServerResponse, allow: string): void {
  response.setHeader('allow', allow)
  sendJson(response, 405, failure(ERROR_CODES.methodNotAllowed, `only ${allow} is allowed`))
}

function sendJson(response: ServerResponse, status: number, value: unknown): void {
  const body = Buffer.from(JSON.stringify(value), 'utf8')
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': String(body.byteLength),
    'cache-control': 'no-store',
  })
  response.end(body)
}
