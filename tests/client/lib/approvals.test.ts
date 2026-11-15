// tests/client/lib/approvals.test.ts
//
// 审批页纯逻辑：相对时间、必填校验、决定构造与错误码映射。

import { describe, expect, it } from 'vitest'
import type { ApprovalView } from '../../../src/shared/approvals.ts'
import {
  buildDecision,
  decisionErrorKey,
  missingRequiredFields,
  relativeTimeParts,
  shortTicket,
} from '../../../src/client/lib/approvals.ts'
import { formatTime } from '../../../src/client/lib/format.ts'
import { translateFor } from '../../../src/client/i18n.ts'

const APPROVAL: ApprovalView = {
  id: 'a-1',
  ticketId: 't-7380b609ef',
  title: '测试审批',
  question: '是否继续？',
  options: [
    { label: '批准', description: '继续' },
    { label: '拒绝', description: '停止' },
  ],
  fields: [
    { key: 'window', label: '时间', type: 'text', required: true },
    { key: 'count', label: '数量', type: 'number' },
    { key: 'urgent', label: '紧急', type: 'boolean' },
  ],
  requestedBySessionId: 'session-1',
  createdAt: 1_700_000_000_000,
}

describe('relativeTimeParts', () => {
  const now = 1_700_000_000_000 + 10 * 24 * 60 * 60 * 1000

  it('uses minutes, hours and days before falling back to an absolute time', () => {
    expect(relativeTimeParts(now, now - 30_000)).toEqual({ kind: 'relative', unit: 'now', value: 0 })
    expect(relativeTimeParts(now, now - 5 * 60_000)).toEqual({ kind: 'relative', unit: 'minute', value: 5 })
    expect(relativeTimeParts(now, now - 3 * 3_600_000)).toEqual({ kind: 'relative', unit: 'hour', value: 3 })
    expect(relativeTimeParts(now, now - 2 * 86_400_000)).toEqual({ kind: 'relative', unit: 'day', value: 2 })
    expect(relativeTimeParts(now, now - 8 * 86_400_000)).toEqual({ kind: 'absolute', at: now - 8 * 86_400_000 })
  })

  it('clamps future timestamps to "now"', () => {
    expect(relativeTimeParts(1000, 5000)).toEqual({ kind: 'relative', unit: 'now', value: 0 })
  })
})

describe('shortTicket', () => {
  it('drops the prefix and keeps six characters', () => {
    expect(shortTicket('t-7380b609ef')).toBe('7380b6')
  })
})

describe('missingRequiredFields', () => {
  it('detects missing and blank required values but accepts false', () => {
    expect(missingRequiredFields(APPROVAL, {})).toEqual([expect.objectContaining({ key: 'window' })])
    expect(missingRequiredFields(APPROVAL, { window: '   ' })).toHaveLength(1)
    expect(
      missingRequiredFields(APPROVAL, { window: '今晚', count: '', urgent: false }),
    ).toEqual([])
  })
})

describe('buildDecision', () => {
  it('builds a selected decision with converted fields and trimmed note', () => {
    expect(
      buildDecision(APPROVAL, {
        optionIndex: 0,
        note: '  继续  ',
        fields: { window: ' 今晚 ', count: ' 3 ', urgent: true },
      }),
    ).toEqual({
      kind: 'selected',
      index: 0,
      note: '继续',
      fields: { window: '今晚', count: 3, urgent: true },
    })
  })

  it('builds a skipped decision without an option', () => {
    expect(buildDecision(APPROVAL, { note: '', fields: { window: '今晚' } })).toEqual({
      kind: 'skipped',
      fields: { window: '今晚' },
    })
  })

  it('rejects an incomplete decision', () => {
    expect(buildDecision(APPROVAL, { optionIndex: 0, note: '', fields: {} })).toBeUndefined()
    expect(
      buildDecision(APPROVAL, { optionIndex: 0, note: '', fields: { window: '今晚', count: 'abc' } }),
    ).toBeUndefined()
    expect(
      buildDecision(APPROVAL, { optionIndex: 5, note: '', fields: { window: '今晚' } }),
    ).toBeUndefined()
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

describe('formatTime', () => {
  it('renders relative time from the dictionary', () => {
    const t = translateFor('zh')
    const now = 1_700_000_000_000

    expect(formatTime(t, 'zh', now + 3 * 60_000, now)).toBe('3 分钟前')
    expect(formatTime(t, 'zh', now + 500, now)).toBe('刚刚')
  })
})
