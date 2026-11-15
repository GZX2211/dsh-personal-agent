// tests/host/console-api/server.test.ts
//
// 同源 HTTP 面的协议层：路径分派、守卫前置、状态码与稳定错误码。
// 用最小的 Node 请求/响应替身，不依赖真实端口。

import type { IncomingMessage, ServerResponse } from 'node:http'
import { describe, expect, it, vi } from 'vitest'
import { API_PREFIX, REQUEST_HEADER, REQUEST_HEADER_VALUE, type SnapshotResponse } from '../../../src/shared/api.ts'
import { createConsoleHandler, type ConsoleTarget } from '../../../src/host/console-api/server.ts'

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
    stats: {
      tickets: { queued: 0, running: 0, blocked: 0, ended: 0, total: 0 },
      approvals: { pending: 0, decided: 0 },
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
    ...overrides,
  }
}

function makeRequest(options: { method?: string; path: string; headers?: Record<string, string> }): IncomingMessage {
  const headers = Object.fromEntries(
    Object.entries(options.headers ?? {}).map(([name, value]) => [name.toLowerCase(), value]),
  )
  return {
    method: options.method ?? 'GET',
    url: options.path,
    headers,
    async *[Symbol.asyncIterator]() {},
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
  requestOptions: { method?: string; path: string; headers?: Record<string, string> },
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
})
