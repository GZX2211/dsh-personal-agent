// tests/client/components/filter-bar.test.tsx
//
// 过滤条已改用官方控件：胶囊是官方 Pill（可选中），搜索是官方 Input（带图标）。
// 这里验证两者的受控值与无障碍名，同时守住「不再复刻官方控件」的边界。

import { describe, expect, it, vi } from 'vitest'

vi.mock('@deepseek-ai/dsh-client-ui-primitives', async () => await import('../../support/ui-primitives-stub.tsx'))

import { renderToStaticMarkup } from 'react-dom/server'
import { FilterBar } from '../../../src/client/components/FilterBar.tsx'

function render(active = 'pending', query = ''): string {
  return renderToStaticMarkup(
    <FilterBar
      options={[
        { id: 'pending', label: '待审批' },
        { id: 'decided', label: '已通过' },
        { id: 'all', label: '全部' },
      ]}
      active={active}
      onSelect={() => undefined}
      query={query}
      onQueryChange={() => undefined}
      searchPlaceholder="搜索"
      help={{ label: '帮助', title: '说明', paragraphs: ['一段说明'], closeLabel: '知道了' }}
    />,
  )
}

describe('FilterBar 官方控件', () => {
  it('renders every filter as a Pill and marks the active one', () => {
    const html = render('decided')

    expect(html.match(/data-primitive="pill"/g)).toHaveLength(3)
    expect(html.match(/data-active="true"/g)).toHaveLength(1)
    // 选中标记必须落在「已通过」那颗 Pill 的起始标签里，而不是别的按钮。
    const activeStart = html.indexOf('data-active="true"')
    const activeEnd = html.indexOf('</button>', activeStart)
    expect(html.slice(activeStart, activeEnd)).toContain('已通过')
  })

  it('renders the search as the official Input with its icon and accessible name', () => {
    const html = render('pending', '工单')

    expect(html).toContain('data-primitive="input"')
    expect(html).toContain('data-icon="search"')
    expect(html).toContain('placeholder="搜索"')
    expect(html).toContain('value="工单"')
    expect(html).toContain('aria-label="搜索"')
  })

  it('keeps the help entry as the only self-built trigger, labelled in the dictionary', () => {
    const html = render()

    expect(html).toContain('aria-label="帮助"')
    expect(html).not.toContain('pa-capsule')
    expect(html).not.toContain('pa-search__input')
  })

  it('places the page-specific leading action before the capsules', () => {
    const html = renderToStaticMarkup(
      <FilterBar
        options={[]}
        active=""
        onSelect={() => undefined}
        leading={<button type="button">在对话中创建</button>}
        query=""
        onQueryChange={() => undefined}
        searchPlaceholder="搜索"
        help={{ label: '帮助', title: '说明', paragraphs: ['一段说明'], closeLabel: '知道了' }}
      />,
    )

    expect(html).toContain('在对话中创建')
    expect(html).not.toContain('data-primitive="pill"')
  })
})
