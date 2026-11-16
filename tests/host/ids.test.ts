// tests/host/ids.test.ts
//
// 账本主键与关联键的规则：工单 `t-`、审批 `a-` 同一形态，短码只用于展示，
// 关联键在同一条审批的生命周期里必须稳定。

import { describe, expect, it } from 'vitest'
import {
  approvalCorrelationId,
  createApprovalId,
  createTicketId,
  shortApprovalId,
} from '../../src/host/ids.ts'

describe('createTicketId / createApprovalId', () => {
  it('builds a ticket id and an approval id from the same ledger-id shape', () => {
    expect(createTicketId()).toMatch(/^t-[0-9a-f]{10}$/)
    expect(createApprovalId()).toMatch(/^a-[0-9a-f]{10}$/)
  })

  it('does not repeat ids across calls', () => {
    const tickets = new Set(Array.from({ length: 50 }, () => createTicketId()))
    const approvals = new Set(Array.from({ length: 50 }, () => createApprovalId()))

    expect(tickets.size).toBe(50)
    expect(approvals.size).toBe(50)
  })
})

describe('shortApprovalId', () => {
  it('drops the approval prefix and keeps six characters', () => {
    expect(shortApprovalId('a-684460e5f9')).toBe('684460')
  })

  it('only strips a leading prefix, never one inside the id', () => {
    expect(shortApprovalId('xa-684460e5f9')).toBe('xa-684')
    expect(shortApprovalId('a-abc')).toBe('abc')
  })
})

describe('approvalCorrelationId', () => {
  it('follows the ticket when the approval is bound to one', () => {
    expect(approvalCorrelationId('a-1', 't-1')).toBe('t-1')
  })

  it('falls back to the approval id for a standalone approval', () => {
    expect(approvalCorrelationId('a-1', undefined)).toBe('a-1')
  })
})
