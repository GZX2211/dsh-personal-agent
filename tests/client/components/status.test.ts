// tests/client/components/status.test.ts
//
// 状态语汇映射：列表行只依赖这两个纯函数把业务状态翻成官方 Tag 色调。

import { describe, expect, it } from 'vitest'
import { riskTagTone, ticketTagTone } from '../../../src/client/components/status.ts'

describe('status 映射', () => {
  it('maps every ticket badge tone to a tag tone', () => {
    expect(ticketTagTone('idle')).toBe('neutral')
    expect(ticketTagTone('business')).toBe('info')
    expect(ticketTagTone('success')).toBe('success')
    expect(ticketTagTone('warn')).toBe('warning')
    expect(ticketTagTone('error')).toBe('danger')
  })

  it('tones approval risk from low to high', () => {
    expect(riskTagTone('low')).toBe('neutral')
    expect(riskTagTone('medium')).toBe('warning')
    expect(riskTagTone('high')).toBe('danger')
  })
})
