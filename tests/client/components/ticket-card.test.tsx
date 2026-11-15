// tests/client/components/ticket-card.test.tsx
//
// 工单卡片的结构契约：与审批卡同一套卡片，但没有展开态、没有动作；头部右侧
// 只有一个状态徽标（阻塞中 / 已中断优先），正文最多两行。

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

  it('clamps the goal to two lines', () => {
    expect(render(ticket())).toContain('pa-card__question--clamp')
  })

  it('shows the stage as the single header badge', () => {
    expect(render(ticket({ stage: 'queued' }))).toContain('待处理')
    expect(render(ticket({ stage: 'running' }))).toContain('进行中')
    expect(render(ticket({ stage: 'ended', outcome: 'completed' }))).toContain('已结束')
  })

  it('prefers blocked and interrupted over the stage badge', () => {
    const blocked = render(ticket({ stage: 'blocked', interrupted: true }))
    const interrupted = render(ticket({ stage: 'running', interrupted: true }))

    expect(blocked).toContain('阻塞中')
    expect(blocked).not.toContain('进行中')
    expect(interrupted).toContain('已中断')
    expect(interrupted).not.toContain('进行中')
  })

  it('tones an ended ticket by its outcome', () => {
    expect(render(ticket({ stage: 'ended', outcome: 'completed' }))).toContain('data-tone="success"')
    expect(render(ticket({ stage: 'ended', outcome: 'failed' }))).toContain('data-tone="error"')
  })

  it('does not repeat the report on the card', () => {
    expect(render(ticket({ stage: 'ended', outcome: 'completed', report: '做完了，产物在 out/' }))).not.toContain('做完了')
  })
})
