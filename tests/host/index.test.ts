// tests/host/index.test.ts
//
// 入口的配置规则：执行槽位只接受正整数，缺省 5；非法值当场失败而不是悄悄取默认，
// 否则配置写错的人会以为限制生效了。

import { describe, expect, it } from 'vitest'
import { resolveMaxWorkers } from '../../src/host/index.ts'

describe('resolveMaxWorkers', () => {
  it('defaults to five slots', () => {
    expect(resolveMaxWorkers(undefined)).toBe(5)
  })

  it('keeps a positive integer as given', () => {
    expect(resolveMaxWorkers(3)).toBe(3)
  })

  it('rejects zero, negative, fractional and non-finite values', () => {
    for (const value of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => resolveMaxWorkers(value), String(value)).toThrow(/positive integer/)
    }
  })
})
