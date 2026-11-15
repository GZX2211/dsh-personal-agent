// tests/client/lib/approvals.test.ts
//
// 审批页纯逻辑：决定构造、短码与错误码映射。

import { describe, expect, it } from 'vitest'
import type { ApprovalView } from '../../../src/shared/approvals.ts'
import {
  buildDecision,
  decisionErrorKey,
  shortTicket,
} from '../../../src/client/lib/approvals.ts'

const APPROVAL: ApprovalView = {
  id: 'a-1',
  ticketId: 't-7380b609ef',
  question: '是否继续？',
  options: [
    { label: '批准', description: '继续' },
    { label: '拒绝', description: '停止' },
  ],
  requestedBySessionId: 'session-1',
  createdAt: 1_700_000_000_000,
}

describe('shortTicket', () => {
  it('drops the prefix and keeps six characters', () => {
    expect(shortTicket('t-7380b609ef')).toBe('7380b6')
  })
})

describe('buildDecision', () => {
  it('builds a selected decision with a trimmed note', () => {
    expect(buildDecision(APPROVAL, { optionIndex: 0, note: '  继续  ' })).toEqual({
      kind: 'selected',
      index: 0,
      note: '继续',
    })
  })

  it('builds a skipped decision without an option', () => {
    expect(buildDecision(APPROVAL, { note: '' })).toEqual({ kind: 'skipped' })
    expect(buildDecision(APPROVAL, { note: '  由你决定  ' })).toEqual({
      kind: 'skipped',
      note: '由你决定',
    })
  })

  it('rejects an out-of-range option index', () => {
    expect(buildDecision(APPROVAL, { optionIndex: 5, note: '' })).toBeUndefined()
    expect(buildDecision(APPROVAL, { optionIndex: -1, note: '' })).toBeUndefined()
  })
})

describe('decisionErrorKey', () => {
  it('maps stable server codes and falls back for unknown ones', () => {
    expect(decisionErrorKey('already-decided')).toBe('decisionErrorAlreadyDecided')
    expect(decisionErrorKey('worker-archived')).toBe('decisionErrorWorkerArchived')
    expect(decisionErrorKey('delivery-failed')).toBe('decisionErrorDeliveryFailed')
    expect(decisionErrorKey('something-else')).toBe('decisionErrorUnknown')
  })
})
