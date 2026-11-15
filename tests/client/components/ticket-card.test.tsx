// tests/client/components/ticket-card.test.tsx
//
// 工单卡片的结构契约：与审批卡同一套卡片，但没有展开态、没有动作、没有阶段
// 徽标与汇报摘要；只有「阻塞中」「已中断」两个副标签。

import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { TicketView } from '../../../src/shared/tickets.ts'
import { TicketCard } from '../../../src/client/components/TicketCard.tsx'
import { translateFor } from '../../../src/client/i18n.ts'

const t = translateFor('zh')
const NOW = new Date(2023, 10, 12, 0, 22).getTime()

function ticket(overrides: Partial<TicketView> = {}): TicketView {
  return {
    id: 't-9c20e78bca',
    shortId: '9c20e7',
    title: '建文件',
    stage: 'running',
    goal: '在 D:\\tmp 下创建 hello.txt',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

function render(card: TicketView): string {
  return renderToStaticMarkup(<TicketCard t={t} language="zh-CN" ticket={card} />)
}

describe('TicketCard', () => {
  it('heads with the short code and the title, and shows the goal as the body', () => {
    const html = render(ticket())

    expect(html).toContain('工单 #9c20e7')
    expect(html).toContain('建文件')
    expect(html).toContain('在 D:\\tmp 下创建 hello.txt')
    expect(html).toContain('11月12日 00:22')
  })

  it('has no expander, no footer and no action buttons', () => {
    const html = render(ticket())

    expect(html).not.toContain('pa-icon-button')
    expect(html).not.toContain('1 / 1')
    expect(html).not.toContain('跳过')
    expect(html).not.toContain('提交')
  })

  it('shows the blocked副标签 for a blocked ticket', () => {
    expect(render(ticket({ stage: 'blocked' }))).toContain('阻塞中')
  })

  it('shows the interrupted副标签 for an interrupted running ticket', () => {
    expect(render(ticket({ stage: 'running', interrupted: true }))).toContain('已中断')
  })

  it('shows no副标签 for a plain running ticket', () => {
    const html = render(ticket())

    expect(html).not.toContain('阻塞中')
    expect(html).not.toContain('已中断')
  })

  it('does not repeat the stage or the report on the card', () => {
    const html = render(ticket({ stage: 'ended', outcome: 'completed', report: '做完了，产物在 out/' }))

    expect(html).not.toContain('已结束')
    expect(html).not.toContain('做完了')
  })

  it('marks the card as focused when opened from an approval', () => {
    const html = renderToStaticMarkup(<TicketCard t={t} language="zh-CN" ticket={ticket()} focused />)

    expect(html).toContain('data-focused="true"')
  })
})
