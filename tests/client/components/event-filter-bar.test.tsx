// tests/client/components/event-filter-bar.test.tsx
//
// 事件页工具栏：两个下拉（事件类型 / 处理方式）+ 搜索 + 帮助。
// 下拉本身只显示当前值；选项列表由官方 Menu 在打开时渲染。

import { describe, expect, it, vi } from 'vitest'

vi.mock('@deepseek-ai/dsh-client-ui-primitives', async () => await import('../../support/ui-primitives-stub.tsx'))

import { renderToStaticMarkup } from 'react-dom/server'
import type { ComponentProps } from 'react'
import { EventFilterBar } from '../../../src/client/components/EventFilterBar.tsx'
import { translateFor } from '../../../src/client/i18n.ts'

const t = translateFor('zh')

const HELP = {
  label: '帮助',
  title: '说明',
  paragraphs: ['一段说明'],
  closeLabel: '知道了',
}

function render(props: Partial<ComponentProps<typeof EventFilterBar>> = {}): string {
  return renderToStaticMarkup(
    <EventFilterBar
      t={t}
      kind="all"
      verdict="all"
      onKindChange={() => undefined}
      onVerdictChange={() => undefined}
      query=""
      onQueryChange={() => undefined}
      help={HELP}
      {...props}
    />,
  )
}

describe('EventFilterBar', () => {
  it('shows the all-values by default', () => {
    const html = render()

    expect(html).toContain('aria-label="事件类型"')
    expect(html).toContain('aria-label="处理方式"')
    expect(html).toContain('全部类型')
    expect(html).toContain('全部处理')
  })

  it('shows the selected values', () => {
    const html = render({ kind: 'perception', verdict: 'reply' })

    expect(html).toContain('感知')
    expect(html).toContain('响应')
    expect(html).not.toContain('全部类型')
    expect(html).not.toContain('全部处理')
  })

  it('shows a supplement as the selected handling type', () => {
    const html = render({ verdict: 'supplement' })

    expect(html).toContain('补充')
    expect(html).not.toContain('全部处理')
  })

  it('renders both triggers as menu buttons and keeps the list closed', () => {
    const html = render()

    expect(html.match(/aria-haspopup="menu"/g)).toHaveLength(2)
    expect(html).not.toContain('role="menu"')
  })

  it('keeps the search field and the help entry', () => {
    const html = render({ query: '配置' })

    expect(html).toContain('pa-toolbar__search')
    expect(html).toContain('aria-label="帮助"')
    expect(html).toContain('value="配置"')
  })
})
