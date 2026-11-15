// tests/host/approvals/message.test.ts
//
// 决定消息是 worker 唯一的续接依据：决定内容、备注、填写字段与「原调用已结束」
// 的提醒都必须完整。

import { describe, expect, it } from 'vitest'
import type { ApprovalView } from '../../../src/shared/approvals.ts'
import { formatApprovalDelivery } from '../../../src/host/approvals/message.ts'

const APPROVAL: ApprovalView = {
  id: 'a-abcdef1234',
  ticketId: 't-abcdef1234',
  title: '要发布吗',
  question: '发布到生产会立刻影响用户。',
  options: [
    { label: '发布', description: '立刻上线' },
    { label: '等等', description: '继续观察' },
  ],
  fields: [{ key: 'window', label: '发布时间', type: 'text', required: true }],
  requestedBySessionId: 'session-1',
  createdAt: 1,
}

describe('formatApprovalDelivery', () => {
  it('states a selected option with its index', () => {
    const text = formatApprovalDelivery(APPROVAL, {
      kind: 'selected',
      index: 1,
      label: '等等',
      note: '先观察一晚',
      fields: { window: '今晚' },
    })

    expect(text).toContain('[审批结果] 审批 a-abcdef1234（工单 t-abcdef1234）已有决定。')
    expect(text).toContain('决定：等等（option 1）')
    expect(text).toContain('补充说明：先观察一晚')
    expect(text).toContain('填写字段：')
    expect(text).toContain('- 发布时间: 今晚')
  })

  it('states a skipped decision', () => {
    const text = formatApprovalDelivery(APPROVAL, { kind: 'skipped' })

    expect(text).toContain('决定：跳过（由你自行决定或放弃该动作）')
    expect(text).not.toContain('补充说明：')
    expect(text).not.toContain('填写字段：')
  })

  it('omits empty notes and fields', () => {
    const text = formatApprovalDelivery(APPROVAL, { kind: 'selected', index: 0, label: '发布', note: '   ' })

    expect(text).not.toContain('补充说明：')
    expect(text).not.toContain('填写字段：')
  })

  it('falls back to the option label and the field key when absent', () => {
    const text = formatApprovalDelivery(APPROVAL, {
      kind: 'selected',
      index: 0,
      fields: { window: '今晚', extra: '未知字段' },
    })

    expect(text).toContain('决定：发布（option 0）')
    expect(text).toContain('- 发布时间: 今晚')
    expect(text).toContain('- extra: 未知字段')
  })

  it('always reminds that the original tool call has ended', () => {
    const text = formatApprovalDelivery(APPROVAL, { kind: 'selected', index: 0, label: '发布' })

    expect(text).toContain('工具调用已结束')
    expect(text).toContain('请再次提交审批')
  })
})
