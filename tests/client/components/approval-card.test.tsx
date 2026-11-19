// tests/client/components/approval-card.test.tsx
//
// 审批列表行的结构契约：默认折叠成一行（状态、题干、发起者、时间、展开按钮），
// 展开后保留原卡片的全部字段（题干、选项、回答、附件、风险、分页与动作）。

import { describe, expect, it, vi } from 'vitest'

vi.mock('@deepseek-ai/dsh-client-ui-primitives', async () => await import('../../support/ui-primitives-stub.tsx'))

import { renderToStaticMarkup } from 'react-dom/server'
import type { ApprovalView } from '../../../src/shared/approvals.ts'
import { NO_ACTIONS } from '../../../src/client/actions.ts'
import { ApprovalCard } from '../../../src/client/components/ApprovalCard.tsx'
import { translateFor } from '../../../src/client/i18n.ts'

const t = translateFor('zh')
const NOW = new Date(2023, 10, 12, 0, 22).getTime()

function approval(overrides: Partial<ApprovalView> = {}): ApprovalView {
  return {
    id: 'a-684460e5f9',
    ticketId: 't-7380b609ef',
    question: '这是一个三选项测试题。',
    options: [
      { label: '选项 A', description: '选择 A 表示同意' },
      { label: '选项 B', description: '选择 B 表示对比' },
    ],
    requestedBySessionId: 'session-19b0e213',
    createdAt: NOW,
    ...overrides,
  }
}

function render(card: ApprovalView, defaultCollapsed?: boolean): string {
  return renderToStaticMarkup(
    <ApprovalCard
      t={t}
      language="zh-CN"
      approval={card}
      actions={NO_ACTIONS}
      busy={false}
      defaultCollapsed={defaultCollapsed}
      onSubmit={() => undefined}
    />,
  )
}

describe('ApprovalCard 折叠行', () => {
  it('starts collapsed: status, question, requester, time and an expander', () => {
    const html = render(approval({ attachments: ['D:/pa-work/t-1/notes.md'] }))

    expect(html).toContain('data-expanded="false"')
    expect(html).toContain('这是一个三选项测试题。')
    expect(html).toContain('19b0e213')
    expect(html).toContain('11月12日 00:22')
    expect(html).toContain('aria-expanded="false"')
    expect(html).toContain('data-tone="warning"')
    expect(html).toContain('data-state="warning"')
    expect(html).not.toContain('输入你的答案')
    expect(html).not.toContain('跳过')
    expect(html).not.toContain('提交')
    expect(html).not.toContain('notes.md')
  })

  it('keeps the requester clickable and free of extra header labels', () => {
    const html = render(approval())

    expect(html).toContain('pa-row__meta-link')
    expect(html).not.toContain('发起者')
    expect(html).not.toContain('关联工单')
  })
})

describe('ApprovalCard 展开态', () => {
  it('keeps every field of the original card when expanded', () => {
    const html = render(
      approval({
        risk: 'high',
        attachments: ['D:/pa-work/t-1/notes.md'],
      }),
      false,
    )

    expect(html).toContain('data-expanded="true"')
    expect(html).toContain('这是一个三选项测试题。')
    expect(html).toContain('选项 A')
    expect(html).toContain('选择 A 表示同意')
    expect(html).toContain('输入你的答案')
    expect(html).toContain('风险')
    expect(html).toContain('高')
    expect(html).toContain('notes.md')
    expect(html).toContain('点击可在右侧栏打开')
    expect(html).toContain('跳过')
    expect(html).toContain('提交')
    expect(html).toContain('1 / 1')
    expect(html).toContain('data-primitive="button"')
  })
})

describe('ApprovalCard 已通过', () => {
  const decided = approval({
    decidedAt: NOW + 60_000,
    decision: { kind: 'selected', index: 1, label: '选项 B', answer: '先观察', transport: 'inline' },
  })

  it('starts collapsed and states the decision time rather than the request time', () => {
    const html = render(decided)

    expect(html).toContain('data-expanded="false"')
    expect(html).toContain('已通过')
    expect(html).toContain('data-tone="success"')
    expect(html).toContain('data-state="done"')
    expect(html).toContain('00:23')
    expect(html).not.toContain('输入你的答案')
    expect(html).not.toContain('跳过')
  })

  it('is read-only once expanded: the choice stays highlighted and no action remains', () => {
    const html = render(
      approval({
        decidedAt: NOW + 60_000,
        decision: { kind: 'selected', index: 1, label: '选项 B', answer: '先观察', transport: 'inline' },
        attachments: ['D:/pa-work/t-1/report.html'],
      }),
      false,
    )

    expect(html).toContain('先观察')
    expect(html).toContain('report.html')
    expect(html).toContain('aria-checked="true"')
    expect(html).not.toContain('pa-detail__answer-input')
    expect(html).not.toContain('跳过')
    expect(html).not.toContain('提交')
  })

  it('marks a skipped request and leaves the answer row out when no text was written', () => {
    const html = render(approval({ decidedAt: NOW + 1000, decision: { kind: 'skipped', transport: 'inline' } }), false)

    expect(html).toContain('已跳过')
    expect(html).toContain('data-tone="neutral"')
    expect(html).toContain('data-state="idle"')
    expect(html).not.toContain('pa-detail__answer-text')
  })

  it('treats a custom answer as decided and shows the answer text', () => {
    const html = render(
      approval({
        decidedAt: NOW + 1000,
        decision: { kind: 'answered', answer: '先观察一晚', transport: 'inline' },
      }),
      false,
    )

    expect(html).toContain('已通过')
    expect(html).not.toContain('已跳过')
    expect(html).toContain('先观察一晚')
    expect(html).not.toContain('跳过')
    expect(html).not.toContain('提交')
  })
})
