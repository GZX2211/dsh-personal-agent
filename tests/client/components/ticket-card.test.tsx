// tests/client/components/ticket-card.test.tsx
//
// 工单行与审批行同一套三行排版：标题（右侧状态徽标与相对时间）/ 目标 / 工单短码；
// 没有展开态、没有动作，状态用官方 Tag 表达。

import { describe, expect, it, vi } from 'vitest'

vi.mock('@deepseek-ai/dsh-client-ui-primitives', async () => await import('../../support/ui-primitives-stub.tsx'))

import { renderToStaticMarkup } from 'react-dom/server'
import type { TicketView } from '../../../src/shared/tickets.ts'
import { TicketCard } from '../../../src/client/components/TicketCard.tsx'
import { translateFor } from '../../../src/client/i18n.ts'

const t = translateFor('zh')
const NOW = new Date(2023, 10, 12, 0, 22).getTime()
const CLOCK = NOW + 2 * 3_600_000

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
  return renderToStaticMarkup(<TicketCard t={t} language="zh-CN" ticket={card} now={CLOCK} />)
}

describe('TicketCard', () => {
  it('lays out the title, goal and ticket reference in three lines', () => {
    const html = render(ticket())

    expect(html).toContain('>建文件</h3>')
    expect(html).toContain('pa-row__summary')
    expect(html).toContain('在 D:\\tmp 下创建 hello.txt')
    expect(html).toContain('工单 #9c20e7')
    expect(html).toContain('pa-row__ref')
    // 时间在标题行右侧，是相对时间；完整时间在悬停提示里。
    expect(html).toContain('2小时前')
    expect(html).toMatch(/pa-row__time[^"]*"[^>]*dateTime="[^"]+"/)
  })

  it('has no expander, no footer actions and no buttons', () => {
    const html = render(ticket())

    expect(html).not.toContain('pa-row__toggle')
    expect(html).not.toContain('aria-expanded')
    expect(html).not.toContain('1 / 1')
    expect(html).not.toContain('跳过')
    expect(html).not.toContain('提交')
  })

  it('shows the stage as the single status tag', () => {
    expect(render(ticket({ stage: 'queued' }))).toContain('待处理')
    expect(render(ticket({ stage: 'running' }))).toContain('进行中')
    expect(render(ticket({ stage: 'ended', outcome: 'completed' }))).toContain('已结束')
  })

  it('prefers blocked and interrupted over the stage tag', () => {
    const blocked = render(ticket({ stage: 'blocked', interrupted: true }))
    const interrupted = render(ticket({ stage: 'running', interrupted: true }))

    expect(blocked).toContain('阻塞中')
    expect(blocked).not.toContain('进行中')
    expect(interrupted).toContain('已中断')
    expect(interrupted).not.toContain('进行中')
  })

  it('maps the status to the official tag tone', () => {
    expect(render(ticket({ stage: 'queued' }))).toContain('data-tone="neutral"')
    expect(render(ticket({ stage: 'running' }))).toContain('data-tone="info"')
    expect(render(ticket({ stage: 'blocked' }))).toContain('data-tone="warning"')
    expect(render(ticket({ stage: 'running', interrupted: true }))).toContain('data-tone="danger"')
    expect(render(ticket({ stage: 'ended', outcome: 'completed' }))).toContain('data-tone="success"')
    expect(render(ticket({ stage: 'ended', outcome: 'failed' }))).toContain('data-tone="danger"')
  })

  it('does not repeat the report on the row', () => {
    expect(render(ticket({ stage: 'ended', outcome: 'completed', report: '做完了，产物在 out/' }))).not.toContain('做完了')
  })

  it('makes the whole row a button when it opens the detail', () => {
    const html = renderToStaticMarkup(
      <TicketCard t={t} language="zh-CN" ticket={ticket()} now={CLOCK} onOpen={() => undefined} />,
    )

    expect(html).toContain('role="button"')
    expect(html).toContain('tabindex="0"')
    expect(html).toContain('pa-row--activatable')
  })

  it('stays a plain list row without an opener', () => {
    const html = render(ticket())

    expect(html).toContain('role="listitem"')
    expect(html).not.toContain('tabindex="0"')
    expect(html).not.toContain('pa-row--activatable')
  })
})
