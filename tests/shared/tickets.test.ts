// tests/shared/tickets.test.ts
//
// 工单视图契约里唯一的可执行规则：展示短码。Host 的投影/标题/查询与 Client 的
// 搜索都用它，所以它必须只有一份实现，规则在共享层被钉住。

import { describe, expect, it } from 'vitest'
import { shortTicketId } from '../../src/shared/tickets.ts'

describe('shortTicketId', () => {
  it('drops the ticket prefix and keeps six characters', () => {
    expect(shortTicketId('t-7380b609ef')).toBe('7380b6')
  })

  it('keeps the first six characters when there is no prefix to drop', () => {
    expect(shortTicketId('9c20e78bca')).toBe('9c20e7')
  })

  it('returns short ids unchanged instead of padding them', () => {
    expect(shortTicketId('t-abc')).toBe('abc')
  })

  it('only strips a leading ticket prefix, never one inside the id', () => {
    expect(shortTicketId('at-123456')).toBe('at-123')
    expect(shortTicketId('')).toBe('')
  })
})
