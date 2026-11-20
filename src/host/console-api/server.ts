// src/host/console-api/server.ts
//
// 同源 HTTP 面的路由器：一个 Node 请求进，一个 JSON 响应出。
// 只做协议层工作（路径分派、同源守卫、状态码），数据由注入的 snapshot 提供。

import type { IncomingMessage, ServerResponse } from 'node:http'
import {
  APPROVAL_DECIDE_PATTERN,
  ERROR_CODES,
  ROUTES,
  SOURCE_REMOVE_PATTERN,
  SOURCE_TEST_PATTERN,
  SOURCE_TOGGLE_PATTERN,
  type DecisionOutcome,
  type ErrorResponse,
  type HealthResponse,
  type SignalQuery,
  type SignalQueryResponse,
  type SnapshotResponse,
  type SourceRemoveResponse,
  type SourceTestRequest,
  type SourceTestResponse,
  type SourceToggleRequest,
  type SourceToggleResponse,
} from '../../shared/api.ts'
import type {
  PromptSaveResponse,
  PromptVersion,
  SettingsSaveResponse,
  SettingsView,
} from '../../shared/settings.ts'
import { guardRequest } from './guard.ts'

/** 设置请求体上限：三份提示词各自可达 32000 字符，中文 UTF-8 下约 288 KiB。 */
const SETTINGS_BODY_LIMIT = 512 * 1024

/** 来源操作的响应：成功体或稳定错误体，状态码由装配层按错误语义给出。 */
export interface SourceToggleOutcome {
  status: number
  body: SourceToggleResponse | ErrorResponse
}

export interface SourceTestOutcome {
  status: number
  body: SourceTestResponse | ErrorResponse
}

export interface SourceRemoveOutcome {
  status: number
  body: SourceRemoveResponse | ErrorResponse
}

/** 保存设置的成功体或稳定错误体；状态码由装配层按错误语义给出。 */
export interface SettingsSaveOutcome {
  status: number
  body: SettingsSaveResponse | ErrorResponse
}

export interface PromptSaveOutcome {
  status: number
  body: PromptSaveResponse | ErrorResponse
}

export interface PromptVersionOutcome {
  status: number
  body: PromptVersion | ErrorResponse
}

export interface ConsoleTarget {
  plugin: string
  version: string
  origin: string
  stateDir: string
  startedAt: number
  /** 读一次总控台视图；账本不可用时抛错，由路由转成 internal 而不是空快照。 */
  snapshot: () => Promise<SnapshotResponse> | SnapshotResponse
  /** 提交一次审批决定；请求体未经校验，由审批服务收窄。 */
  decideApproval: (approvalId: string, request: unknown) => Promise<DecisionOutcome>
  /** 开关来源或单条线程；请求体已由协议层收窄。 */
  toggleSource: (sourceId: string, request: SourceToggleRequest) => Promise<SourceToggleOutcome>
  /** 测试来源；请求体已由协议层收窄。 */
  testSource: (sourceId: string, request: SourceTestRequest) => Promise<SourceTestOutcome>
  /** 删除来源；已删除与不存在都返回同一个结果，避免重复删除报错。 */
  removeSource: (sourceId: string) => Promise<SourceRemoveOutcome>
  /** 从账本全量检索信号。 */
  querySignals: (query: SignalQuery) => Promise<SignalQueryResponse> | SignalQueryResponse
  /** 设置页一次读取所需的全部状态。 */
  getSettings: () => Promise<SettingsView>
  /** 保存执行器配置；请求体未经校验，由设置服务收窄。 */
  saveExecutor: (body: unknown) => Promise<SettingsSaveOutcome>
  /** 保存派单规则。 */
  savePolicy: (body: unknown) => Promise<SettingsSaveOutcome>
  /** 保存一个新的提示词版本。 */
  savePrompts: (body: unknown) => Promise<PromptSaveOutcome>
  /** 读取一个历史提示词版本。 */
  getPromptRevision: (revision: number) => Promise<PromptVersionOutcome>
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
  if (path === ROUTES.health) {    if (method !== 'GET' && method !== 'HEAD') {
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

  if (path === ROUTES.signals) {
    if (method !== 'GET') return sendMethodNotAllowed(response, 'GET')
    return sendJson(response, 200, await target.querySignals(readSignalQuery(request, target.origin)))
  }

  if (path === ROUTES.settings) {
    if (method !== 'GET') return sendMethodNotAllowed(response, 'GET')
    return sendJson(response, 200, await target.getSettings())
  }

  if (path === ROUTES.settingsExecutor || path === ROUTES.settingsPolicy) {
    if (method !== 'POST') return sendMethodNotAllowed(response, 'POST')
    let body: unknown
    try {
      body = await readJson(request, SETTINGS_BODY_LIMIT)
    } catch (error) {
      return sendJson(response, 400, failure(ERROR_CODES.badRequest, describe(error)))
    }
    const outcome =
      path === ROUTES.settingsExecutor
        ? await target.saveExecutor(body)
        : await target.savePolicy(body)
    return sendJson(response, outcome.status, outcome.body)
  }

  if (path === ROUTES.prompts) {
    if (method === 'GET') {
      const revision = readPromptRevision(request, target.origin)
      if (revision === undefined) {
        return sendJson(
          response,
          400,
          failure(ERROR_CODES.badRequest, 'revision must be a non-negative integer'),
        )
      }
      const outcome = await target.getPromptRevision(revision)
      return sendJson(response, outcome.status, outcome.body)
    }
    if (method !== 'POST') return sendMethodNotAllowed(response, 'GET, POST')
    let body: unknown
    try {
      body = await readJson(request, SETTINGS_BODY_LIMIT)
    } catch (error) {
      return sendJson(response, 400, failure(ERROR_CODES.badRequest, describe(error)))
    }
    const outcome = await target.savePrompts(body)
    return sendJson(response, outcome.status, outcome.body)
  }

  const decision = APPROVAL_DECIDE_PATTERN.exec(path)
  if (decision !== null) {
    if (method !== 'POST') return sendMethodNotAllowed(response, 'POST')
    let body: unknown
    try {
      body = await readJson(request)
    } catch (error) {
      return sendJson(
        response,
        400,
        failure(ERROR_CODES.badRequest, error instanceof Error ? error.message : String(error)),
      )
    }
    const approvalId = decodeURIComponent(decision[1] ?? '')
    const outcome = await target.decideApproval(approvalId, body)
    return sendJson(response, outcome.status, outcome.body)
  }

  const toggle = SOURCE_TOGGLE_PATTERN.exec(path)
  if (toggle !== null) {
    if (method !== 'POST') return sendMethodNotAllowed(response, 'POST')
    const body = await readBodyOrBadRequest(response, request)
    if (body === BAD_REQUEST) return
    let parsed: SourceToggleRequest
    try {
      parsed = readToggleRequest(body)
    } catch (error) {
      return sendJson(response, 400, failure(ERROR_CODES.badRequest, describe(error)))
    }
    const outcome = await target.toggleSource(decodeURIComponent(toggle[1] ?? ''), parsed)
    return sendJson(response, outcome.status, outcome.body)
  }

  const test = SOURCE_TEST_PATTERN.exec(path)
  if (test !== null) {
    if (method !== 'POST') return sendMethodNotAllowed(response, 'POST')
    const body = await readBodyOrBadRequest(response, request)
    if (body === BAD_REQUEST) return
    let parsed: SourceTestRequest
    try {
      parsed = readTestRequest(body)
    } catch (error) {
      return sendJson(response, 400, failure(ERROR_CODES.badRequest, describe(error)))
    }
    const outcome = await target.testSource(decodeURIComponent(test[1] ?? ''), parsed)
    return sendJson(response, outcome.status, outcome.body)
  }

  const removal = SOURCE_REMOVE_PATTERN.exec(path)
  if (removal !== null) {
    if (method !== 'DELETE') return sendMethodNotAllowed(response, 'DELETE')
    const outcome = await target.removeSource(decodeURIComponent(removal[1] ?? ''))
    return sendJson(response, outcome.status, outcome.body)
  }

  return sendJson(response, 404, failure(ERROR_CODES.notFound, `no route for ${path}`))
}

/**
 * 读取可选请求体：空体是合法的（测试与开关都不必带内容）。
 *
 * 非法 JSON 与超限都当场回 400，返回哨兵让调用方直接结束。
 */
const BAD_REQUEST = Symbol('bad-request')

async function readBodyOrBadRequest(
  response: ServerResponse,
  request: IncomingMessage,
): Promise<unknown | typeof BAD_REQUEST> {
  try {
    return await readJson(request)
  } catch (error) {
    sendJson(response, 400, failure(ERROR_CODES.badRequest, describe(error)))
    return BAD_REQUEST
  }
}

function readToggleRequest(body: unknown): SourceToggleRequest {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new Error('toggle body must be an object')
  }
  const record = body as { enabled?: unknown; threadId?: unknown }
  if (typeof record.enabled !== 'boolean') {
    throw new Error('toggle body requires a boolean enabled')
  }
  if (record.threadId !== undefined && typeof record.threadId !== 'string') {
    throw new Error('toggle threadId must be a string')
  }
  const parsed: SourceToggleRequest = { enabled: record.enabled }
  if (record.threadId !== undefined) parsed.threadId = record.threadId
  return parsed
}

function readTestRequest(body: unknown): SourceTestRequest {
  if (body === undefined) return {}
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new Error('test body must be an object')
  }
  const waitMs = (body as { waitMs?: unknown }).waitMs
  if (waitMs === undefined) return {}
  if (typeof waitMs !== 'number' || !Number.isFinite(waitMs)) {
    throw new Error('test waitMs must be a finite number')
  }
  return { waitMs }
}

function readSignalQuery(request: IncomingMessage, origin: string): SignalQuery {
  const url = new URL(request.url ?? '/', origin)
  const query: SignalQuery = {}
  const text = url.searchParams.get('q')
  if (text !== null) query.q = text
  const rawLimit = url.searchParams.get('limit')
  if (rawLimit !== null && rawLimit.trim().length > 0) {
    const limit = Number(rawLimit)
    // 非数字交给契约缺省，而不是把它当成 0 条。
    if (Number.isFinite(limit)) query.limit = limit
  }
  return query
}

/** 提示词版本必须是明确的非负整数；缺失与非法都回 400，让调用点自己修正。 */
function readPromptRevision(request: IncomingMessage, origin: string): number | undefined {
  const url = new URL(request.url ?? '/', origin)
  const raw = url.searchParams.get('revision')
  if (raw === null || raw.trim().length === 0) return undefined
  const value = Number(raw)
  return Number.isInteger(value) && value >= 0 ? value : undefined
}

function failure(code: ErrorResponse['code'], message: string): ErrorResponse {
  return { ok: false, code, message }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
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

/** 读取 JSON 请求体；只负责不撑爆内存，结构校验交给设置服务。 */
async function readJson(request: IncomingMessage, maxBytes = 64 * 1024): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of request) {
    const buffer = chunk as Buffer
    size += buffer.byteLength
    if (size > maxBytes) throw new Error(`request body exceeds ${Math.floor(maxBytes / 1024)} KiB`)
    chunks.push(buffer)
  }
  const text = Buffer.concat(chunks).toString('utf8').trim()
  if (text.length === 0) return undefined
  try {
    return JSON.parse(text) as unknown
  } catch (error) {
    throw new Error(`request body is not valid JSON: ${error instanceof Error ? error.message : String(error)}`)
  }
}
