// tests/client/lib/format.test.ts
//
// 卡片上的时间是绝对时间（与宿主列表一致），不是相对时间。

import { describe, expect, it } from 'vitest'
import { formatTimestamp } from '../../../src/client/lib/format.ts'

/** 用本地时间构造，避免断言依赖运行机器时区。 */
const AT = new Date(2023, 10, 12, 0, 22).getTime()

describe('formatTimestamp', () => {
  it('renders month, day and a 24-hour clock in Chinese', () => {
    const text = formatTimestamp('zh-CN', AT)

    expect(text).toContain('11月12日')
    expect(text).toContain('00:22')
  })

  it('renders a short month name in English', () => {
    const text = formatTimestamp('en-US', AT)

    expect(text).toContain('Nov')
    expect(text).toContain('00:22')
    expect(text).not.toContain('AM')
  })

  it('falls back to English for an empty language code', () => {
    expect(formatTimestamp('', AT)).toContain('Nov')
  })
})
