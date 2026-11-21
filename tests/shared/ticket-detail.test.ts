// tests/shared/ticket-detail.test.ts
//
// 详情页的路径契约：一条工单一个路径，id 编码后进路径，因此它不能借斜杠改写路由。

import { describe, expect, it } from 'vitest'
import { API_PREFIX } from '../../src/shared/api.ts'
import { ticketDetailPath, TICKET_DETAIL_PATTERN } from '../../src/shared/ticket-detail.ts'

describe('ticketDetailPath', () => {
  it('builds one path per ticket', () => {
    expect(ticketDetailPath('t-9c20e78bca')).toBe(`${API_PREFIX}/tickets/t-9c20e78bca`)
  })

  it('encodes the id so a slash cannot escape the route', () => {
    expect(ticketDetailPath('t-1/../x')).toBe(`${API_PREFIX}/tickets/t-1%2F..%2Fx`)
    expect(TICKET_DETAIL_PATTERN.test(ticketDetailPath('t-1/../x'))).toBe(true)
  })
})

describe('TICKET_DETAIL_PATTERN', () => {
  it('captures the ticket id', () => {
    expect(TICKET_DETAIL_PATTERN.exec(`${API_PREFIX}/tickets/t-9c20e78bca`)?.[1]).toBe('t-9c20e78bca')
  })

  it('rejects a nested path', () => {
    expect(TICKET_DETAIL_PATTERN.test(`${API_PREFIX}/tickets/t-1/extra`)).toBe(false)
    expect(TICKET_DETAIL_PATTERN.test(`${API_PREFIX}/tickets/`)).toBe(false)
  })

  it('round-trips an encoded id', () => {
    const match = TICKET_DETAIL_PATTERN.exec(ticketDetailPath('t-1 空格'))

    expect(decodeURIComponent(match?.[1] ?? '')).toBe('t-1 空格')
  })
})
