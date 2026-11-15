// tests/host/console-api/guard.test.ts
//
// 同源守卫的三重证据：Origin、Referer、Sec-Fetch-Site。
// 宿主页面可能用 Referrer-Policy 去掉 Referer，浏览器同源 GET 又不发 Origin，
// 因此 Sec-Fetch-Site 是必要的兜底；但只接受浏览器强制写入的 same-origin。

import type { IncomingMessage } from 'node:http'
import { describe, expect, it } from 'vitest'
import { REQUEST_HEADER, REQUEST_HEADER_VALUE } from '../../../src/shared/api.ts'
import { guardRequest } from '../../../src/host/console-api/guard.ts'

const ORIGIN = 'http://127.0.0.1:60432'

function request(headers: Record<string, string>): IncomingMessage {
  return { headers: { [REQUEST_HEADER]: REQUEST_HEADER_VALUE, ...headers } } as unknown as IncomingMessage
}

describe('guardRequest', () => {
  it('rejects a request without the plugin header', () => {
    const verdict = guardRequest(ORIGIN, { headers: {} } as unknown as IncomingMessage)

    expect(verdict).toMatchObject({ ok: false, code: 'missing-request-header' })
  })

  it('accepts the exact origin', () => {
    expect(guardRequest(ORIGIN, request({ origin: ORIGIN }))).toEqual({ ok: true })
  })

  it('rejects a foreign origin', () => {
    expect(guardRequest(ORIGIN, request({ origin: 'http://evil.example' }))).toMatchObject({
      ok: false,
      code: 'wrong-origin',
    })
  })

  it('accepts a same-origin referer', () => {
    expect(guardRequest(ORIGIN, request({ referer: `${ORIGIN}/session/x` }))).toEqual({ ok: true })
  })

  it('rejects a foreign referer', () => {
    expect(guardRequest(ORIGIN, request({ referer: 'http://evil.example/x' }))).toMatchObject({
      ok: false,
      code: 'wrong-origin',
    })
  })

  it('accepts a same-origin fetch without Origin or Referer', () => {
    expect(guardRequest(ORIGIN, request({ 'sec-fetch-site': 'same-origin' }))).toEqual({ ok: true })
  })

  it('rejects a cross-site fetch without Origin or Referer', () => {
    expect(guardRequest(ORIGIN, request({ 'sec-fetch-site': 'cross-site' }))).toMatchObject({
      ok: false,
      code: 'wrong-origin',
    })
  })

  it('rejects a request that proves no origin at all', () => {
    expect(guardRequest(ORIGIN, request({}))).toMatchObject({ ok: false, code: 'wrong-origin' })
  })
})
