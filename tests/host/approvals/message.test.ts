// tests/host/approvals/message.test.ts
//
// 决定消息是 worker 唯一的续接依据：决定内容、答案文本与「原调用已结束」
// 的提醒都必须完整。

import { describe, expect, it } from 'vitest'
import type { ApprovalView } from '../../../src/shared/approvals.ts'
import { formatApprovalDelivery } from '../../../src/host/approvals/message.ts'

const APPROVAL: ApprovalView = {
  id: 'a-abcdef1234',
  ticketId: 't-abcdef1234',
  question: '发布到生产会立刻影响用户。',
  options: [
    { label: '发布', description: '立刻上线' },
    { label: '等等', description: '继续观察' },
  ],
  attachments: ['D:/work/t-abcdef1234/notes.md'],
  requestedBySessionId: 'session-1',
  createdAt: 1,
}

describe('formatApprovalDelivery', () => {
  it('states a selected option and carries the text answer along', () => {
    const text = formatApprovalDelivery(APPROVAL, {
      kind: 'selected',
      index: 1,
      label: '等等',
      answer: '先观察一晚',
    })

    expect(text).toContain('[审批结果] 审批 a-abcdef1234（工单 t-abcdef1234）已有决定。')
    expect(text).toContain('决定：等等（option 1）')
    expect(text).toContain('答案：先观察一晚')
  })

  it('states a skipped decision', () => {
    const text = formatApprovalDelivery(APPROVAL, { kind: 'skipped' })

    expect(text).toContain('决定：跳过（由你自行决定或放弃该动作）')
    expect(text).not.toContain('答案：')
  })

  it('delivers a custom answer into the worker context', () => {
    const text = formatApprovalDelivery(APPROVAL, { kind: 'answered', answer: '先观察一晚' })

    expect(text).toContain('决定：自定义答案')
    expect(text).toContain('答案：先观察一晚')
  })

  it('omits an empty answer', () => {
    const text = formatApprovalDelivery(APPROVAL, { kind: 'selected', index: 0, label: '发布', answer: '   ' })

    expect(text).not.toContain('答案：')
  })

  it('falls back to the option label when the decision carries none', () => {
    const text = formatApprovalDelivery(APPROVAL, { kind: 'selected', index: 0 })

    expect(text).toContain('决定：发布（option 0）')
  })

  it('omits the ticket clause for a standalone approval', () => {
    const { ticketId: _ticketId, ...standalone } = APPROVAL
    const text = formatApprovalDelivery(standalone, { kind: 'skipped' })

    expect(text).toContain('[审批结果] 审批 a-abcdef1234 已有决定。')
    expect(text).not.toContain('工单')
  })

  it('always reminds that the original tool call has ended', () => {
    const text = formatApprovalDelivery(APPROVAL, { kind: 'selected', index: 0, label: '发布' })

    expect(text).toContain('工具调用已结束')
    expect(text).toContain('请再次提交审批')
  })
})
