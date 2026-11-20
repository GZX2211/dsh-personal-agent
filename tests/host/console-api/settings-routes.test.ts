// tests/host/console-api/settings-routes.test.ts
//
// 设置端点的协议层：路径分派、同源守卫、状态码与稳定错误码；数据本身由装配层
// 注入的设置服务给出，这里只验证「请求正确到达、响应原样返回」。

import { describe, expect, it } from 'vitest'
import {
  ERROR_CODES,
  ROUTES,
  promptRevisionPath,
  REQUEST_HEADER,
  REQUEST_HEADER_VALUE,
} from '../../../src/shared/api.ts'
import { call, makeTarget, ORIGIN } from '../../support/console-http.ts'

const HEADERS = { [REQUEST_HEADER]: REQUEST_HEADER_VALUE }

describe('GET /settings', () => {
  it('returns the settings view', async () => {
    const { captured, json } = await call(makeTarget(), { path: ROUTES.settings, headers: HEADERS })

    expect(captured.status).toBe(200)
    expect(json).toMatchObject({ revision: 0, policy: { rules: [] } })
  })

  it('rejects a request without the explicit header', async () => {
    const { captured, json } = await call(makeTarget(), { path: ROUTES.settings })

    expect(captured.status).toBe(403)
    expect(json).toEqual({ ok: false, code: ERROR_CODES.missingRequestHeader, message: expect.any(String) })
  })

  it('rejects a non-GET method', async () => {
    const { captured } = await call(makeTarget(), {
      method: 'POST',
      path: ROUTES.settings,
      headers: HEADERS,
    })

    expect(captured.status).toBe(405)
    expect(captured.headers.allow).toBe('GET')
  })
})

describe('POST /settings/executor and /settings/policy', () => {
  it('passes the executor body to the save action', async () => {
    let received: unknown
    const body = { executor: { maxWorkers: 8, model: null, rootDirectory: null }, revision: 0 }
    const { captured, json } = await call(
      makeTarget({
        saveExecutor: async input => {
          received = input
          return { status: 200, body: { ok: true, revision: 1, policyVersion: '12345678' } }
        },
      }),
      { method: 'POST', path: ROUTES.settingsExecutor, headers: HEADERS, body },
    )

    expect(captured.status).toBe(200)
    expect(received).toEqual(body)
    expect(json).toEqual({ ok: true, revision: 1, policyVersion: '12345678' })
  })

  it('maps a stale revision failure to 409 with its stable code', async () => {
    const { captured, json } = await call(
      makeTarget({
        savePolicy: async () => ({
          status: 409,
          body: { ok: false, code: ERROR_CODES.settingsConflict, message: 'stale' },
        }),
      }),
      { method: 'POST', path: ROUTES.settingsPolicy, headers: HEADERS, body: { rules: [], revision: 0 } },
    )

    expect(captured.status).toBe(409)
    expect(json).toEqual({ ok: false, code: ERROR_CODES.settingsConflict, message: 'stale' })
  })

  it('rejects a malformed JSON body before calling the save action', async () => {
    const { captured } = await call(
      makeTarget({
        saveExecutor: async () => {
          throw new Error('should not be called')
        },
      }),
      { method: 'POST', path: ROUTES.settingsExecutor, headers: HEADERS, rawBody: '{not json' },
    )

    expect(captured.status).toBe(400)
    expect(captured.body).toContain(ERROR_CODES.badRequest)
  })

  it('rejects a GET on a save endpoint', async () => {
    const { captured } = await call(makeTarget(), {
      path: ROUTES.settingsExecutor,
      headers: HEADERS,
    })

    expect(captured.status).toBe(405)
    expect(captured.headers.allow).toBe('POST')
  })
})

describe('prompt endpoints', () => {
  it('saves a prompt version through the injected action', async () => {
    let received: unknown
    const body = {
      texts: { shared: 's', router: 'r', worker: 'w' },
      baseRevision: 0,
    }
    const { captured, json } = await call(
      makeTarget({
        savePrompts: async input => {
          received = input
          return { status: 200, body: { ok: true, version: { revision: 1, savedAt: '', source: 'panel', parts: 3, chars: 3 } } }
        },
      }),
      { method: 'POST', path: ROUTES.prompts, headers: HEADERS, body },
    )

    expect(captured.status).toBe(200)
    expect(received).toEqual(body)
    expect(json).toMatchObject({ ok: true, version: { revision: 1 } })
  })

  it('reads a historical revision by number', async () => {
    const { captured, json } = await call(makeTarget(), {
      path: promptRevisionPath(2),
      headers: HEADERS,
    })

    expect(captured.status).toBe(200)
    expect(json).toMatchObject({ revision: 2 })
  })

  it('rejects a missing or invalid revision', async () => {
    const missing = await call(makeTarget(), { path: ROUTES.prompts, headers: HEADERS })
    const invalid = await call(makeTarget(), { path: `${ROUTES.prompts}?revision=abc`, headers: HEADERS })

    expect(missing.captured.status).toBe(400)
    expect(invalid.captured.status).toBe(400)
  })

  it('maps a missing revision to 404 with its stable code', async () => {
    const { captured, json } = await call(
      makeTarget({
        getPromptRevision: async () => ({
          status: 404,
          body: { ok: false, code: ERROR_CODES.promptRevisionNotFound, message: 'missing' },
        }),
      }),
      { path: promptRevisionPath(9), headers: HEADERS },
    )

    expect(captured.status).toBe(404)
    expect(json).toEqual({ ok: false, code: ERROR_CODES.promptRevisionNotFound, message: 'missing' })
  })

  it('accepts a settings-sized body even when it exceeds the generic 64 KiB limit', async () => {
    const large = 'x'.repeat(80 * 1024)
    const { captured } = await call(makeTarget(), {
      method: 'POST',
      path: ROUTES.prompts,
      headers: HEADERS,
      body: { texts: { shared: large, router: 'r', worker: 'w' }, baseRevision: 0 },
    })

    expect(captured.status).toBe(200)
  })

  it('rejects a negative revision', async () => {
    const { captured } = await call(makeTarget(), {
      path: `${ROUTES.prompts}?revision=-1`,
      headers: HEADERS,
    })

    expect(captured.status).toBe(400)
  })

  it('rejects a prompt body beyond the settings body limit', async () => {
    const huge = 'x'.repeat(600 * 1024)
    const { captured } = await call(makeTarget(), {
      method: 'POST',
      path: ROUTES.prompts,
      headers: HEADERS,
      body: { texts: { shared: huge, router: 'r', worker: 'w' }, baseRevision: 0 },
    })

    expect(captured.status).toBe(400)
    expect(captured.body).toContain(ERROR_CODES.badRequest)
  })

  it('passes an empty body through so the service decides it is invalid', async () => {
    let received: unknown = 'not-called'
    const { captured } = await call(
      makeTarget({
        saveExecutor: async input => {
          received = input
          return {
            status: 400,
            body: { ok: false, code: ERROR_CODES.settingsInvalid, message: '请求体必须是对象' },
          }
        },
      }),
      { method: 'POST', path: ROUTES.settingsExecutor, headers: HEADERS },
    )

    expect(received).toBeUndefined()
    expect(captured.status).toBe(400)
  })

  it('rejects a wrong origin even with the explicit header', async () => {
    const { captured, json } = await call(makeTarget(), {
      path: ROUTES.settings,
      headers: { ...HEADERS, origin: 'http://evil.example' },
    })

    expect(captured.status).toBe(403)
    expect(json).toMatchObject({ ok: false, code: ERROR_CODES.wrongOrigin })
  })

  it('does not answer settings paths outside the origin', async () => {
    const { captured } = await call(makeTarget(), {
      path: ROUTES.settings,
      headers: { ...HEADERS, origin: ORIGIN },
    })

    expect(captured.status).toBe(200)
  })
})
