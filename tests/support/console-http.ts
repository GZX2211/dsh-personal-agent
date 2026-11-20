// tests/support/console-http.ts
//
// 同源 HTTP 面的最小请求/响应替身：不依赖真实端口，也不 Mock 协议层本身。

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { SnapshotResponse } from '../../src/shared/api.ts'
import type { PromptVersion, SettingsView } from '../../src/shared/settings.ts'
import { createConsoleHandler, type ConsoleTarget } from '../../src/host/console-api/server.ts'

export const ORIGIN = 'http://127.0.0.1:52810'

export interface Captured {
  status: number
  headers: Record<string, unknown>
  body: string
}

export function emptySnapshot(): SnapshotResponse {
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

export function emptySettings(): SettingsView {
  return {
    revision: 0,
    executor: { maxWorkers: 5, model: null, rootDirectory: null },
    defaultRoot: 'C:\\state\\personal-agent\\work',
    policy: { rules: [], version: '00000000' },
    prompts: {
      current: { revision: 0, savedAt: '', source: 'defaults', parts: 3, chars: 30, texts: { shared: 's', router: 'r', worker: 'w' } },
      defaults: { shared: 's', router: 'r', worker: 'w' },
      history: [],
    },
    models: { default: null, providers: [], failures: [] },
  }
}

export function promptVersion(revision: number): PromptVersion {
  return {
    revision,
    savedAt: '2026-01-01T00:00:00.000Z',
    source: 'panel',
    parts: 3,
    chars: 3,
    texts: { shared: 's', router: 'r', worker: 'w' },
  }
}

export function makeTarget(overrides: Partial<ConsoleTarget> = {}): ConsoleTarget {
  return {
    plugin: 'dsh-personal-agent',
    version: '0.1.0',
    origin: ORIGIN,
    stateDir: 'C:\\state\\personal-agent',
    startedAt: Date.now() - 1_000,
    snapshot: () => emptySnapshot(),
    decideApproval: async () => ({ status: 200, body: { ok: true, transport: 'inline' } }),
    toggleSource: async () => ({
      status: 200,
      body: {
        ok: true,
        source: {
          id: 'src-1',
          name: '本地文件',
          enabled: true,
          channelKind: 'fs-watch',
          config: { kind: 'fs-watch', paths: ['D:/tmp/a.txt'], recursive: false },
          status: 'running',
          threads: [],
          deliveredCount: 0,
          filteredCount: 0,
        },
      },
    }),
    testSource: async () => ({ status: 200, body: { ok: true, signals: [] } }),
    removeSource: async () => ({ status: 200, body: { ok: true, removed: true } }),
    querySignals: () => ({ signals: [], total: 0 }),
    getSettings: async () => emptySettings(),
    saveExecutor: async () => ({ status: 200, body: { ok: true, revision: 1, policyVersion: '12345678' } }),
    savePolicy: async () => ({ status: 200, body: { ok: true, revision: 1, policyVersion: '12345678' } }),
    savePrompts: async () => ({ status: 200, body: { ok: true, version: promptVersion(1) } }),
    getPromptRevision: async revision => ({ status: 200, body: promptVersion(revision) }),
    ...overrides,
  }
}

export function makeRequest(options: {
  method?: string
  path: string
  headers?: Record<string, string>
  body?: unknown
  /** 原始请求体，用于构造非法 JSON。 */
  rawBody?: string
}): IncomingMessage {
  const headers = Object.fromEntries(
    Object.entries(options.headers ?? {}).map(([name, value]) => [name.toLowerCase(), value]),
  )
  const body =
    options.rawBody !== undefined
      ? Buffer.from(options.rawBody, 'utf8')
      : options.body === undefined
        ? undefined
        : Buffer.from(JSON.stringify(options.body), 'utf8')
  return {
    method: options.method ?? 'GET',
    url: options.path,
    headers,
    async *[Symbol.asyncIterator]() {
      if (body !== undefined) yield body
    },
  } as unknown as IncomingMessage
}

export function makeResponse(): { response: ServerResponse; captured: Captured } {
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

export async function call(
  target: ConsoleTarget,
  requestOptions: {
    method?: string
    path: string
    headers?: Record<string, string>
    body?: unknown
    rawBody?: string
  },
): Promise<{ captured: Captured; json: unknown }> {
  const { response, captured } = makeResponse()
  await createConsoleHandler(target)(makeRequest(requestOptions), response)
  return { captured, json: captured.body.length === 0 ? undefined : JSON.parse(captured.body) }
}
