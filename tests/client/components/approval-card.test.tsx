// tests/client/components/approval-card.test.tsx
//
// 审批卡片的结构契约：待审批默认展开、已通过默认折叠且只读、附件为空时
// 整行不渲染。用服务端静态渲染，不依赖浏览器 DOM。

import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ApprovalView } from '../../../src/shared/approvals.ts'
import type { TicketView } from '../../../src/shared/tickets.ts'
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

const TICKETS = new Map<string, TicketView>([
  [
    't-7380b609ef',
    {
      id: 't-7380b609ef',
      shortId: '7380b6',
      title: '发布新版本',
      stage: 'blocked',
      goal: '把 v2 发出去',
      createdAt: NOW,
      updatedAt: NOW,
    },
  ],
])

function render(card: ApprovalView, defaultCollapsed?: boolean): string {
  return renderToStaticMarkup(
    <ApprovalCard
      t={t}
      language="zh-CN"
      approval={card}
      tickets={TICKETS}
      actions={NO_ACTIONS}
      busy={false}
      defaultCollapsed={defaultCollapsed}
      onSubmit={() => undefined}
    />,
  )
}

describe('ApprovalCard 待审批', () => {
  it('opens expanded with the question, options, answer field and both actions', () => {
    const html = render(approval({ attachments: ['D:/pa-work/t-1/notes.md'] }))

    expect(html).toContain('这是一个三选项测试题。')
    expect(html).toContain('选项 A')
    expect(html).toContain('选择 A 表示同意')
    expect(html).toContain('输入你的答案')
    expect(html).toContain('notes.md')
    expect(html).toContain('跳过')
    expect(html).toContain('提交')
    expect(html).toContain('1 / 1')
  })

  it('names the requester and the related ticket in the eyebrow', () => {
    const html = render(approval())

    expect(html).toContain('发起者')
    expect(html).toContain('19b0e213')
    expect(html).toContain('关联工单')
    expect(html).toContain('发布新版本')
  })

  it('hides the attachment row entirely when the worker sent none', () => {
    const html = render(approval())

    expect(html).not.toContain('附件')
    expect(html).not.toContain('点击可在右侧栏打开')
  })
})

describe('ApprovalCard 已通过', () => {
  const decided = approval({
    decidedAt: NOW + 60_000,
    decision: { kind: 'selected', index: 1, label: '选项 B', note: '先观察', transport: 'inline' },
  })

  it('starts collapsed and shows only the header strip', () => {
    const html = render(decided)

    expect(html).toContain('data-collapsed="true"')
    expect(html).toContain('已通过')
    expect(html).not.toContain('输入你的答案')
    expect(html).not.toContain('跳过')
    expect(html).not.toContain('提交')
  })

  it('states the decision time rather than the request time', () => {
    expect(render(decided)).toContain('00:23')
  })

  it('is read-only once expanded: the choice stays highlighted and no action remains', () => {
    const html = render(
      approval({
        decidedAt: NOW + 60_000,
        decision: { kind: 'selected', index: 1, label: '选项 B', note: '先观察', transport: 'inline' },
        attachments: ['D:/pa-work/t-1/report.html'],
      }),
      false,
    )

    expect(html).toContain('先观察')
    expect(html).toContain('report.html')
    expect(html).toContain('aria-checked="true"')
    expect(html).toContain('disabled')
    expect(html).not.toContain('跳过')
    expect(html).not.toContain('提交')
  })

  it('marks a skipped request and leaves the answer row out when no note was written', () => {
    const html = render(approval({ decidedAt: NOW + 1000, decision: { kind: 'skipped', transport: 'inline' } }), false)

    expect(html).toContain('已跳过')
    expect(html).not.toContain('pa-card__answer-row')
  })
})
