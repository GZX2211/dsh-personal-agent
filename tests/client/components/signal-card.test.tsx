// tests/client/components/signal-card.test.tsx
//
// 事件卡片：类型、来源行、事实、结局与推断标记。有工单的结局是按钮，
// 其余结局只是只读事实。

import { describe, expect, it, vi } from 'vitest'

vi.mock('@deepseek-ai/dsh-client-ui-primitives', async () => await import('../../support/ui-primitives-stub.tsx'))

import { renderToStaticMarkup } from 'react-dom/server'
import type { ComponentProps } from 'react'
import type { SignalView } from '../../../src/shared/signals.ts'
import { SignalCard } from '../../../src/client/components/SignalCard.tsx'
import { translateFor } from '../../../src/client/i18n.ts'

const t = translateFor('zh')
const NOW = 1_700_000_000_000

function signal(overrides: Partial<SignalView> = {}): SignalView {
  return {
    signalId: 's-1',
    kind: 'user-message',
    receivedAt: NOW - 2 * 60_000,
    delivered: true,
    text: '把 README 改一下',
    ...overrides,
  }
}

function render(props: Partial<ComponentProps<typeof SignalCard>> = {}): string {
  return renderToStaticMarkup(
    <SignalCard t={t} language="zh" now={NOW} signal={signal()} {...props} />,
  )
}

describe('SignalCard', () => {
  it('shows the kind, the conversation and an inferred reply', () => {
    const html = render({
      signal: signal({ decision: { action: 'reply', inferred: true, at: NOW } }),
    })

    expect(html).toContain('用户')
    expect(html).toContain('对话')
    expect(html).toContain('把 README 改一下')
    expect(html).toContain('响应')
    expect(html).toContain('推断')
    expect(html).toContain('2分钟前')
    // 结局与推断都在时间左侧，三段同在右侧一行。
    expect(html.indexOf('推断')).toBeLessThan(html.indexOf('pa-signal__time'))
    expect(html).toContain('pa-signal__aside')
  })

  it('shows the source and thread of a perception signal', () => {
    const html = render({
      signal: signal({
        kind: 'perception',
        sourceName: '配置文件',
        threadName: '变更',
        text: 'app.yml 被修改',
      }),
    })

    expect(html).toContain('感知')
    expect(html).toContain('配置文件 · 变更')
  })

  it('makes a dispatch verdict a button that opens the ticket', () => {
    const html = render({
      signal: signal({
        kind: 'perception',
        decision: { action: 'dispatch', ticketId: 't-9c20e78bca', at: NOW },
      }),
      onOpenTicket: () => undefined,
    })

    expect(html).toContain('派发 #9c20e7')
    expect(html).toContain('data-primitive="button"')
    // 可点击的结局用同一个 Tag 渲染尺寸，按钮只包一层点击区域。
    expect(html).toContain('pa-signal__verdict')
    expect(html).toContain('pa-signal__verdict-tag')
    expect(html.indexOf('派发 #9c20e7')).toBeLessThan(html.indexOf('pa-signal__time'))
  })

  it('makes a supplement verdict a button that opens the ticket', () => {
    const html = render({
      signal: signal({
        kind: 'perception',
        decision: { action: 'supplement', ticketId: 't-9c20e78bca', at: NOW },
      }),
      onOpenTicket: () => undefined,
    })

    expect(html).toContain('补充 #9c20e7')
    expect(html).toContain('data-primitive="button"')
  })

  it('keeps the verdict read-only without a ticket opener', () => {
    const html = render({
      signal: signal({
        kind: 'perception',
        decision: { action: 'append', ticketId: 't-9c20e78bca', at: NOW },
      }),
    })

    expect(html).toContain('追加 #9c20e7')
    expect(html).not.toContain('data-primitive="button"')
  })

  it('shows the matched rule of a filtered signal', () => {
    const html = render({
      signal: signal({ kind: 'perception', delivered: false, rule: 'min-gap', text: '被节流的事实' }),
    })

    expect(html).toContain('已过滤 · 节流')
    expect(html).not.toContain('data-primitive="button"')
  })

  it('shows pending for a delivered signal without a decision', () => {
    expect(render()).toContain('待处理')
  })

  it('hides the source line in compact mode', () => {
    const html = render({ compact: true })

    expect(html).toContain('pa-signal--compact')
    expect(html).not.toContain('对话')
  })
})
