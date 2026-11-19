// tests/shared/api.test.ts
//
// HTTP 契约的路径与错误码：Host 与 Client 共用这一份，任何一侧硬编码字面量都会
// 让它们悄悄走散。这里验证可观察的契约——路径形状、模式捕获与查询拼接。

import { describe, expect, it } from 'vitest'
import {
  API_PREFIX,
  ERROR_CODES,
  sourceRemovePath,
  sourceTestPath,
  sourceTogglePath,
  SOURCE_REMOVE_PATTERN,
  SOURCE_TEST_PATTERN,
  SOURCE_TOGGLE_PATTERN,
  signalQueryPath,
  SIGNAL_QUERY_LIMIT,
} from '../../src/shared/api.ts'

describe('来源操作路径', () => {
  it('builds one path per action under the same source', () => {
    expect(sourceTogglePath('src-1')).toBe(`${API_PREFIX}/sources/src-1/toggle`)
    expect(sourceTestPath('src-1')).toBe(`${API_PREFIX}/sources/src-1/test`)
    expect(sourceRemovePath('src-1')).toBe(`${API_PREFIX}/sources/src-1`)
  })

  it('encodes source ids so a slash cannot escape the route', () => {
    expect(sourceTogglePath('src/../x')).toBe(`${API_PREFIX}/sources/src%2F..%2Fx/toggle`)
    expect(sourceRemovePath('a b')).toBe(`${API_PREFIX}/sources/a%20b`)
  })

  it('captures the source id with the matching pattern only', () => {
    expect(SOURCE_TOGGLE_PATTERN.exec(sourceTogglePath('src-1'))?.[1]).toBe('src-1')
    expect(SOURCE_TEST_PATTERN.exec(sourceTestPath('src-1'))?.[1]).toBe('src-1')
    expect(SOURCE_REMOVE_PATTERN.exec(sourceRemovePath('src-1'))?.[1]).toBe('src-1')

    // 删除模式不能吞掉子动作：否则 toggle 会被误判成删除。
    expect(SOURCE_REMOVE_PATTERN.exec(sourceTogglePath('src-1'))).toBeNull()
    expect(SOURCE_REMOVE_PATTERN.exec(sourceTestPath('src-1'))).toBeNull()
    expect(SOURCE_TOGGLE_PATTERN.exec(sourceTestPath('src-1'))).toBeNull()
  })

  it('round-trips a non-ASCII source id through the route pattern', () => {
    const id = '来源 一/二'
    const path = sourceTogglePath(id)

    expect(path).not.toContain('/二')
    expect(decodeURIComponent(SOURCE_TOGGLE_PATTERN.exec(path)?.[1] ?? '')).toBe(id)
  })
})

describe('信号查询路径', () => {
  it('returns the bare route when there is no query', () => {
    expect(signalQueryPath()).toBe(`${API_PREFIX}/signals`)
    expect(signalQueryPath({})).toBe(`${API_PREFIX}/signals`)
  })

  it('carries the search text and limit as query parameters', () => {
    const path = signalQueryPath({ q: '配置文件 变更', limit: 50 })
    const url = new URL(path, 'http://127.0.0.1')

    expect(url.pathname).toBe(`${API_PREFIX}/signals`)
    expect(url.searchParams.get('q')).toBe('配置文件 变更')
    expect(url.searchParams.get('limit')).toBe('50')
  })

  it('omits blank text and clamps the limit to the contract range', () => {
    const blank = new URL(signalQueryPath({ q: '   ' }), 'http://127.0.0.1')
    expect(blank.search).toBe('')

    const low = new URL(signalQueryPath({ limit: 0 }), 'http://127.0.0.1')
    expect(low.searchParams.get('limit')).toBe(String(SIGNAL_QUERY_LIMIT.min))

    const high = new URL(signalQueryPath({ limit: 10_000 }), 'http://127.0.0.1')
    expect(high.searchParams.get('limit')).toBe(String(SIGNAL_QUERY_LIMIT.max))
  })

  it('truncates a fractional limit and falls back for a non-finite one', () => {
    const fractional = new URL(signalQueryPath({ limit: 1.9 }), 'http://127.0.0.1')
    expect(fractional.searchParams.get('limit')).toBe('1')

    const broken = new URL(signalQueryPath({ limit: Number.NaN }), 'http://127.0.0.1')
    expect(broken.searchParams.get('limit')).toBe(String(SIGNAL_QUERY_LIMIT.default))
  })

  it('keeps search characters that look like query syntax', () => {
    const path = signalQueryPath({ q: 'a&b=c #1' })
    const url = new URL(path, 'http://127.0.0.1')

    expect(url.searchParams.get('q')).toBe('a&b=c #1')
  })
})

describe('稳定错误码', () => {
  it('covers the source failures the UI branches on', () => {
    expect(ERROR_CODES.sourceNotFound).toBe('source-not-found')
    expect(ERROR_CODES.sourceInvalid).toBe('source-invalid')
    expect(ERROR_CODES.sourceStartFailed).toBe('source-start-failed')
  })

  it('keeps every code unique', () => {
    const codes = Object.values(ERROR_CODES)
    expect(new Set(codes).size).toBe(codes.length)
  })
})
