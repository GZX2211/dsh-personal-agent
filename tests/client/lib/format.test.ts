// tests/client/lib/format.test.ts
//
// 卡片上的时间是绝对时间（与宿主列表一致）；来源/事件卡片用相对时间，一周以上
// 也回到绝对时间。

import { describe, expect, it } from 'vitest'
import {
  formatDayLabel,
  formatDuration,
  formatNumber,
  formatRelativeTime,
  formatTimestamp,
  formatTokens,
} from '../../../src/client/lib/format.ts'
import { translateFor } from '../../../src/client/i18n.ts'

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

describe('formatRelativeTime', () => {
  const t = translateFor('zh')
  const now = AT + 30 * 24 * 3_600_000

  it('uses the localized just-now copy inside a minute', () => {
    expect(formatRelativeTime(t, 'zh', now - 30_000, now)).toBe('刚刚')
  })

  it('treats a future timestamp as just now instead of a negative age', () => {
    expect(formatRelativeTime(t, 'zh', now + 60_000, now)).toBe('刚刚')
  })

  it('counts minutes, hours and days', () => {
    expect(formatRelativeTime(t, 'zh', now - 5 * 60_000, now)).toBe('5分钟前')
    expect(formatRelativeTime(t, 'zh', now - 3 * 3_600_000, now)).toBe('3小时前')
    expect(formatRelativeTime(t, 'zh', now - 2 * 24 * 3_600_000, now)).toBe('2天前')
  })

  it('falls back to the absolute time after a week', () => {
    expect(formatRelativeTime(t, 'zh', now - 8 * 24 * 3_600_000, now)).toBe(formatTimestamp('zh', now - 8 * 24 * 3_600_000))
  })
})

describe('formatDuration', () => {
  const t = translateFor('zh')

  it('uses the localized under-a-minute copy', () => {
    expect(formatDuration(t, 'zh', 59_000)).toBe('不到 1 分钟')
  })

  it('treats a negative duration as under a minute', () => {
    expect(formatDuration(t, 'zh', -5_000)).toBe('不到 1 分钟')
  })

  it('renders minutes and hours', () => {
    expect(formatDuration(t, 'zh', 5 * 60_000)).toBe('5分钟')
    expect(formatDuration(t, 'en', 120 * 60_000)).toBe('2h')
  })

  it('keeps the minute remainder after an hour', () => {
    expect(formatDuration(t, 'zh', 125 * 60_000)).toBe('2小时 5分钟')
    expect(formatDuration(t, 'en', 125 * 60_000)).toBe('2h 5m')
  })
})

describe('formatTokens', () => {
  it('compacts token counts per locale', () => {
    expect(formatTokens('en', 640_000)).toBe('640K')
    expect(formatTokens('zh', 640_000)).toBe('64万')
    expect(formatTokens('', 1_000_000)).toBe('1M')
  })
})

describe('formatDayLabel', () => {
  it('renders the short weekday of the given day', () => {
    const day = new Date(2026, 10, 21).getTime()

    expect(formatDayLabel('en', day)).toBe('Sat')
    expect(formatDayLabel('zh', day)).toBe('周六')
    expect(formatDayLabel('', day)).toBe('Sat')
  })
})

describe('formatNumber', () => {
  it('groups thousands for the footer totals', () => {
    expect(formatNumber('en', 1_284)).toBe('1,284')
    expect(formatNumber('zh', 24)).toBe('24')
  })
})
