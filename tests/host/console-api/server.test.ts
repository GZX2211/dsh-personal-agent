// tests/host/console-api/server.test.ts
//
// 同源 HTTP 面的协议层：路径分派、守卫前置、状态码与稳定错误码。
// 用最小的 Node 请求/响应替身，不依赖真实端口。

import type { IncomingMessage, ServerResponse } from 'node:http'
import { describe, expect, it, vi } from 'vitest'
import {
  API_PREFIX,
  approvalDecidePath,
  REQUEST_HEADER,
  REQUEST_HEADER_VALUE,
  ROUTES,
  sourceRemovePath,
  sourceTestPath,
  sourceTogglePath,
  type SnapshotResponse,
} from '../../../src/shared/api.ts'
import type { SourceView } from '../../../src/shared/sources.ts'
import { createConsoleHandler, type ConsoleTarget } from '../../../src/host/console-api/server.ts'
import { emptySettings, promptVersion } from '../../support/console-http.ts'

const ORIGIN = 'http://127.0.0.1:52810'

interface Captured {
  status: number
  headers: Record<string, unknown>
  body: string
}

function emptySnapshot(): SnapshotResponse {
  return {
    tickets: [],
    approvals: [],
    signals: [],
    sources: [],
    timers: [],
    stats: {
      tickets: { queued: 0, running: 0, blocked: 0, ended: 0, total: 0 },
      approvals: { pending: 0, decided: 0 },
      signals: { delivered: 0, filtered: 0, total: 0 },
    },
  }
}

function makeTarget(overrides: Partial<ConsoleTarget> = {}): ConsoleTarget {
  return {
    plugin: 'dsh-personal-agent',
    version: '0.1.0',
    origin: ORIGIN,
    stateDir: 'C:\\state\\personal-agent',
    startedAt: Date.now() - 1_000,
    snapshot: () => emptySnapshot(),
    decideApproval: async () => ({ status: 200, body: { ok: true, transport: 'inline' } }),
    toggleSource: async () => ({ status: 200, body: { ok: true, source: sourceView() } }),
    testSource: async () => ({ status: 200, body: { ok: true, signals: [] } }),
    removeSource: async () => ({ status: 200, body: { ok: true, removed: true } }),
    querySignals: () => ({ signals: [], total: 0 }),
    getSettings: async () => emptySettings(),
    saveExecutor: async () => ({
      status: 200,
      body: { ok: true, revision: 1, policyVersion: '12345678', permissionVersion: '87654321' },
    }),
    savePolicy: async () => ({
      status: 200,
      body: { ok: true, revision: 1, policyVersion: '12345678', permissionVersion: '87654321' },
    }),
    savePrompts: async () => ({ status: 200, body: { ok: true, version: promptVersion(1) } }),
    getPromptRevision: async revision => ({ status: 200, body: promptVersion(revision) }),
    ...overrides,
  }
}

function sourceView(): SourceView {
  return {
    id: 'src-1',
    name: '本地文件',
    enabled: true,
    channelKind: 'fs-watch',
    config: { kind: 'fs-watch', paths: ['D:/tmp/a.txt'], recursive: false },
    status: 'running',
    threads: [{ id: 'changes', name: '变更', enabled: true, deliveredCount: 0, filteredCount: 0 }],
    deliveredCount: 0,
    filteredCount: 0,
  }
}

function makeRequest(options: {
  method?: string
  path: string
  headers?: Record<string, string>
  body?: unknown
}): IncomingMessage {
  const headers = Object.fromEntries(
    Object.entries(options.headers ?? {}).map(([name, value]) => [name.toLowerCase(), value]),
  )
  const body = options.body === undefined ? undefined : Buffer.from(JSON.stringify(options.body), 'utf8')
  return {
    method: options.method ?? 'GET',
    url: options.path,
    headers,
    async *[Symbol.asyncIterator]() {
      if (body !== undefined) yield body
    },
  } as unknown as IncomingMessage
}

function makeResponse(): { response: ServerResponse; captured: Captured } {
  const captured: Captured = { status: 0, headers: {}, body: '' }
  const response = {
    setHeader: (name: string, value: unknown) => {
      captured.headers[name.toLowerCase()] = value
    },
    writeHead: (status: number, headers: Record<string, unknown>) => {
      captured.status = status
      Object.assign(captured.headers, headers)
    },
    end: (body?: unknown) => {
      captured.body = body === undefined ? '' : String(body)
    },
  } as unknown as ServerResponse
  return { response, captured }
}

async function call(
  target: ConsoleTarget,
  requestOptions: { method?: string; path: string; headers?: Record<string, string>; body?: unknown },
): Promise<{ captured: Captured; json: unknown }> {
  const { response, captured } = makeResponse()
  await createConsoleHandler(target)(makeRequest(requestOptions), response)
  return { captured, json: captured.body.length === 0 ? undefined : JSON.parse(captured.body) }
}

const sameOriginHeaders = { [REQUEST_HEADER]: REQUEST_HEADER_VALUE, origin: ORIGIN }

describe('console api', () => {
  it('serves health without any header', async () => {
    const { captured, json } = await call(makeTarget(), { path: `${API_PREFIX}/health` })

    expect(captured.status).toBe(200)
    expect(json).toEqual({
      ok: true,
      plugin: 'dsh-personal-agent',
      version: '0.1.0',
      origin: ORIGIN,
      stateDir: 'C:\\state\\personal-agent',
      uptimeMs: expect.any(Number),
    })
  })

  it('rejects a non-GET health request', async () => {
    const { captured, json } = await call(makeTarget(), { method: 'POST', path: `${API_PREFIX}/health` })

    expect(captured.status).toBe(405)
    expect(captured.headers.allow).toBe('GET, HEAD')
    expect(json).toEqual({ ok: false, code: 'method-not-allowed', message: expect.any(String) })
  })

  it('rejects a snapshot request without the plugin header and never touches the ledger', async () => {
    const snapshot = vi.fn(() => emptySnapshot())

    const { captured, json } = await call(makeTarget({ snapshot }), { path: `${API_PREFIX}/snapshot` })

    expect(captured.status).toBe(403)
    expect(json).toEqual({ ok: false, code: 'missing-request-header', message: expect.any(String) })
    expect(snapshot).not.toHaveBeenCalled()
  })

  it('rejects a snapshot request from a foreign origin', async () => {
    const { captured, json } = await call(makeTarget(), {
      path: `${API_PREFIX}/snapshot`,
      headers: { [REQUEST_HEADER]: REQUEST_HEADER_VALUE, origin: 'http://evil.example' },
    })

    expect(captured.status).toBe(403)
    expect(json).toEqual({ ok: false, code: 'wrong-origin', message: expect.any(String) })
  })

  it('serves the snapshot to a same-origin caller', async () => {
    const snapshot = emptySnapshot()

    const { captured, json } = await call(makeTarget({ snapshot: () => snapshot }), {
      path: `${API_PREFIX}/snapshot`,
      headers: { [REQUEST_HEADER]: REQUEST_HEADER_VALUE, referer: `${ORIGIN}/session/x` },
    })

    expect(captured.status).toBe(200)
    expect(captured.headers['content-type']).toBe('application/json; charset=utf-8')
    expect(captured.headers['cache-control']).toBe('no-store')
    expect(json).toEqual(snapshot)
  })

  it('serves the snapshot to a same-origin caller carrying an Origin header', async () => {
    const { captured } = await call(makeTarget(), {
      path: `${API_PREFIX}/snapshot`,
      headers: sameOriginHeaders,
    })

    expect(captured.status).toBe(200)
  })

  it('rejects a non-GET snapshot request after the guard', async () => {
    const { captured, json } = await call(makeTarget(), {
      method: 'POST',
      path: `${API_PREFIX}/snapshot`,
      headers: sameOriginHeaders,
    })

    expect(captured.status).toBe(405)
    expect(captured.headers.allow).toBe('GET')
    expect(json).toEqual({ ok: false, code: 'method-not-allowed', message: expect.any(String) })
  })

  it('returns a stable not-found code for an unknown path', async () => {
    const { captured, json } = await call(makeTarget(), {
      path: `${API_PREFIX}/dev/p0`,
      headers: sameOriginHeaders,
    })

    expect(captured.status).toBe(404)
    expect(json).toEqual({ ok: false, code: 'not-found', message: expect.any(String) })
  })

  it('reports an unreachable ledger as an internal error instead of an empty snapshot', async () => {
    const target = makeTarget({
      snapshot: () => Promise.reject(new Error('events.jsonl line 1: invalid JSON')),
    })

    const { captured, json } = await call(target, {
      path: `${API_PREFIX}/snapshot`,
      headers: sameOriginHeaders,
    })

    expect(captured.status).toBe(500)
    expect(json).toEqual({ ok: false, code: 'internal', message: 'events.jsonl line 1: invalid JSON' })
  })

  it('forwards a decision request to the approval service', async () => {
    const decideApproval = vi.fn(async () => ({
      status: 200,
      body: { ok: true as const, transport: 'inline' as const },
    }))

    const { captured, json } = await call(makeTarget({ decideApproval }), {
      method: 'POST',
      path: approvalDecidePath('a-1'),
      headers: sameOriginHeaders,
      body: { kind: 'selected', index: 1, answer: '先别发' },
    })

    expect(captured.status).toBe(200)
    expect(json).toEqual({ ok: true, transport: 'inline' })
    expect(decideApproval).toHaveBeenCalledWith('a-1', { kind: 'selected', index: 1, answer: '先别发' })
  })

  it('returns the approval service status and failure body unchanged', async () => {
    const target = makeTarget({
      decideApproval: async () => ({
        status: 409,
        body: { ok: false, code: 'already-decided', message: '审批 a-1 已经处理过' },
      }),
    })

    const { captured, json } = await call(target, {
      method: 'POST',
      path: approvalDecidePath('a-1'),
      headers: sameOriginHeaders,
      body: { kind: 'skipped' },
    })

    expect(captured.status).toBe(409)
    expect(json).toEqual({ ok: false, code: 'already-decided', message: '审批 a-1 已经处理过' })
  })

  it('requires POST for the decision endpoint', async () => {
    const decideApproval = vi.fn()
    const { captured } = await call(makeTarget({ decideApproval }), {
      path: approvalDecidePath('a-1'),
      headers: sameOriginHeaders,
    })

    expect(captured.status).toBe(405)
    expect(captured.headers.allow).toBe('POST')
    expect(decideApproval).not.toHaveBeenCalled()
  })

  it('guards the decision endpoint like other state endpoints', async () => {
    const decideApproval = vi.fn()
    const { captured, json } = await call(makeTarget({ decideApproval }), {
      method: 'POST',
      path: approvalDecidePath('a-1'),
      body: { kind: 'skipped' },
    })

    expect(captured.status).toBe(403)
    expect(json).toEqual({ ok: false, code: 'missing-request-header', message: expect.any(String) })
    expect(decideApproval).not.toHaveBeenCalled()
  })

  it('rejects a malformed JSON body before calling the approval service', async () => {
    const decideApproval = vi.fn()
    const { response, captured } = makeResponse()
    const request = makeRequest({ method: 'POST', path: approvalDecidePath('a-1'), headers: sameOriginHeaders })
    // 原始请求体不是合法 JSON。
    ;(request as unknown as { [Symbol.asyncIterator]: () => AsyncGenerator<Buffer> })[Symbol.asyncIterator] =
      async function* () {
        yield Buffer.from('{not json', 'utf8')
      }

    await createConsoleHandler(makeTarget({ decideApproval }))(request, response)

    expect(captured.status).toBe(400)
    expect(decideApproval).not.toHaveBeenCalled()
  })

  it('rejects a request body larger than 64 KiB before calling the approval service', async () => {
    const decideApproval = vi.fn()
    const { response, captured } = makeResponse()
    const request = makeRequest({ method: 'POST', path: approvalDecidePath('a-1'), headers: sameOriginHeaders })
    ;(request as unknown as { [Symbol.asyncIterator]: () => AsyncGenerator<Buffer> })[Symbol.asyncIterator] =
      async function* () {
        yield Buffer.alloc(64 * 1024 + 1, 0x20)
      }

    await createConsoleHandler(makeTarget({ decideApproval }))(request, response)

    expect(captured.status).toBe(400)
    expect(JSON.parse(captured.body)).toMatchObject({
      ok: false,
      code: 'bad-request',
      message: expect.stringContaining('64 KiB'),
    })
    expect(decideApproval).not.toHaveBeenCalled()
  })
})

describe('source routes', () => {
  it('forwards a source toggle', async () => {
    const toggleSource = vi.fn(async () => ({
      status: 200,
      body: { ok: true as const, source: sourceView() },
    }))

    const { captured, json } = await call(makeTarget({ toggleSource }), {
      method: 'POST',
      path: sourceTogglePath('src-1'),
      headers: sameOriginHeaders,
      body: { enabled: false, threadId: 'changes' },
    })

    expect(captured.status).toBe(200)
    expect(toggleSource).toHaveBeenCalledWith('src-1', { enabled: false, threadId: 'changes' })
    expect(json).toEqual({ ok: true, source: sourceView() })
  })

  it('rejects a toggle body without a boolean enabled', async () => {
    const toggleSource = vi.fn()

    const { captured } = await call(makeTarget({ toggleSource }), {
      method: 'POST',
      path: sourceTogglePath('src-1'),
      headers: sameOriginHeaders,
      body: { enabled: 'yes' },
    })

    expect(captured.status).toBe(400)
    expect(JSON.parse(captured.body)).toMatchObject({ ok: false, code: 'bad-request' })
    expect(toggleSource).not.toHaveBeenCalled()
  })

  it('rejects a thread id that is not a string', async () => {
    const toggleSource = vi.fn()

    const { captured } = await call(makeTarget({ toggleSource }), {
      method: 'POST',
      path: sourceTogglePath('src-1'),
      headers: sameOriginHeaders,
      body: { enabled: true, threadId: 7 },
    })

    expect(captured.status).toBe(400)
    expect(toggleSource).not.toHaveBeenCalled()
  })

  it('forwards the service outcome of a failed toggle unchanged', async () => {
    const target = makeTarget({
      toggleSource: async () => ({
        status: 404,
        body: { ok: false, code: 'source-not-found', message: '来源不存在：src-1' },
      }),
    })

    const { captured, json } = await call(target, {
      method: 'POST',
      path: sourceTogglePath('src-1'),
      headers: sameOriginHeaders,
      body: { enabled: true },
    })

    expect(captured.status).toBe(404)
    expect(json).toEqual({ ok: false, code: 'source-not-found', message: '来源不存在：src-1' })
  })

  it('forwards a source test without a body', async () => {
    const testSource = vi.fn(async () => ({ status: 200, body: { ok: true as const, signals: [] } }))

    const { captured, json } = await call(makeTarget({ testSource }), {
      method: 'POST',
      path: sourceTestPath('src-1'),
      headers: sameOriginHeaders,
    })

    expect(captured.status).toBe(200)
    expect(testSource).toHaveBeenCalledWith('src-1', {})
    expect(json).toEqual({ ok: true, signals: [] })
  })

  it('forwards the wait window of a source test', async () => {
    const testSource = vi.fn(async () => ({ status: 200, body: { ok: true as const, signals: [] } }))

    await call(makeTarget({ testSource }), {
      method: 'POST',
      path: sourceTestPath('src-1'),
      headers: sameOriginHeaders,
      body: { waitMs: 800 },
    })

    expect(testSource).toHaveBeenCalledWith('src-1', { waitMs: 800 })
  })

  it('rejects a wait window that is not a finite number', async () => {
    const testSource = vi.fn()

    const { captured } = await call(makeTarget({ testSource }), {
      method: 'POST',
      path: sourceTestPath('src-1'),
      headers: sameOriginHeaders,
      body: { waitMs: 'soon' },
    })

    expect(captured.status).toBe(400)
    expect(testSource).not.toHaveBeenCalled()
  })

  it('forwards a source removal', async () => {
    const removeSource = vi.fn(async () => ({ status: 200, body: { ok: true as const, removed: true } }))

    const { captured, json } = await call(makeTarget({ removeSource }), {
      method: 'DELETE',
      path: sourceRemovePath('src-1'),
      headers: sameOriginHeaders,
    })

    expect(captured.status).toBe(200)
    expect(removeSource).toHaveBeenCalledWith('src-1')
    expect(json).toEqual({ ok: true, removed: true })
  })

  it('requires DELETE for removal', async () => {
    const removeSource = vi.fn()

    const { captured } = await call(makeTarget({ removeSource }), {
      path: sourceRemovePath('src-1'),
      headers: sameOriginHeaders,
    })

    expect(captured.status).toBe(405)
    expect(captured.headers.allow).toBe('DELETE')
    expect(removeSource).not.toHaveBeenCalled()
  })

  it('guards every source route', async () => {
    const toggleSource = vi.fn()

    const { captured, json } = await call(makeTarget({ toggleSource }), {
      method: 'POST',
      path: sourceTogglePath('src-1'),
      body: { enabled: true },
    })

    expect(captured.status).toBe(403)
    expect(json).toEqual({ ok: false, code: 'missing-request-header', message: expect.any(String) })
    expect(toggleSource).not.toHaveBeenCalled()
  })
})

describe('signal query', () => {
  it('parses the search text and limit', async () => {
    const querySignals = vi.fn(() => ({ signals: [], total: 0 }))

    const { captured, json } = await call(makeTarget({ querySignals }), {
      path: `${ROUTES.signals}?q=${encodeURIComponent('配置 变更')}&limit=50`,
      headers: sameOriginHeaders,
    })

    expect(captured.status).toBe(200)
    expect(querySignals).toHaveBeenCalledWith({ q: '配置 变更', limit: 50 })
    expect(json).toEqual({ signals: [], total: 0 })
  })

  it('drops a limit that is not a finite number', async () => {
    const querySignals = vi.fn(() => ({ signals: [], total: 0 }))

    await call(makeTarget({ querySignals }), {
      path: `${ROUTES.signals}?limit=abc`,
      headers: sameOriginHeaders,
    })

    expect(querySignals).toHaveBeenCalledWith({})
  })

  it('requires GET for the query', async () => {
    const querySignals = vi.fn(() => ({ signals: [], total: 0 }))

    const { captured } = await call(makeTarget({ querySignals }), {
      method: 'POST',
      path: ROUTES.signals,
      headers: sameOriginHeaders,
    })

    expect(captured.status).toBe(405)
    expect(captured.headers.allow).toBe('GET')
    expect(querySignals).not.toHaveBeenCalled()
  })

  it('guards the query like other state endpoints', async () => {
    const querySignals = vi.fn(() => ({ signals: [], total: 0 }))

    const { captured } = await call(makeTarget({ querySignals }), { path: ROUTES.signals })

    expect(captured.status).toBe(403)
    expect(querySignals).not.toHaveBeenCalled()
  })
})
