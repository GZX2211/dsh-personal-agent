// tests/host/console-api/guard.test.ts
//
// 同源守卫的证据链：Origin、Referer、Sec-Fetch-Site。
// 宿主页面可能用 Referrer-Policy 去掉 Referer，浏览器同源 GET 又不发 Origin，
// 因此 Sec-Fetch-Site 是必要的兜底；但只接受浏览器强制写入的 same-origin。
// 桌面端（dsh-app://app）把请求转发给 Host 时会剥离 Origin、Referer 与 Sec-Fetch-Site，
// 所以「三项全缺席」是转发形态而非来源伪造：浏览器跨站请求必带 Origin 或 Sec-Fetch-Site。

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

  it('rejects a same-site but cross-origin fetch', () => {
    expect(guardRequest(ORIGIN, request({ 'sec-fetch-site': 'same-site' }))).toMatchObject({
      ok: false,
      code: 'wrong-origin',
    })
  })

  it('rejects a navigation that declares no site', () => {
    expect(guardRequest(ORIGIN, request({ 'sec-fetch-site': 'none' }))).toMatchObject({
      ok: false,
      code: 'wrong-origin',
    })
  })

  it('accepts the desktop application page as its referer', () => {
    expect(guardRequest(ORIGIN, request({ referer: 'dsh-app://app/' }))).toEqual({ ok: true })
  })

  it('rejects a referer that only shares the desktop scheme prefix', () => {
    expect(guardRequest(ORIGIN, request({ referer: 'dsh-app://app2/x' }))).toMatchObject({
      ok: false,
      code: 'wrong-origin',
    })
  })

  it('accepts the desktop-forwarded request that carries no browser origin evidence', () => {
    // 桌面端转发会删除 Origin、Referer 与 Sec-Fetch-Site，并注入 Host 认证 cookie。
    // 浏览器跨站请求不可能同时缺席三者：跨站 CORS 请求带 Origin，简单请求带 Sec-Fetch-Site。
    expect(guardRequest(ORIGIN, request({}))).toEqual({ ok: true })
  })

  it('rejects a foreign origin even when the request also carries a desktop referer', () => {
    expect(
      guardRequest(ORIGIN, request({ origin: 'http://evil.example', referer: 'dsh-app://app/' })),
    ).toMatchObject({ ok: false, code: 'wrong-origin' })
  })

  it('rejects a referer that only shares the console host as a prefix', () => {
    expect(guardRequest(ORIGIN, request({ referer: `${ORIGIN}.evil.example/x` }))).toMatchObject({
      ok: false,
      code: 'wrong-origin',
    })
  })

  it('rejects the opaque null origin a sandboxed frame sends', () => {
    expect(guardRequest(ORIGIN, request({ origin: 'null' }))).toMatchObject({
      ok: false,
      code: 'wrong-origin',
    })
  })

  it('accepts a desktop referer that carries a path', () => {
    expect(guardRequest(ORIGIN, request({ referer: 'dsh-app://app/index.html?tab=approvals' }))).toEqual({
      ok: true,
    })
  })
})
