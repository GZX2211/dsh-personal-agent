// tests/client/components/console-tab-strip.test.tsx
//
// 标签条的待审批徽标：有数量时渲染成可读的圆点，零与缺省不占位。

import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ConsoleTabStrip, type ConsoleTab } from '../../../src/client/components/ConsoleTabStrip.tsx'

function render(tabs: readonly ConsoleTab[], active = 'approvals'): string {
  return renderToStaticMarkup(<ConsoleTabStrip tabs={tabs} active={active} onSelect={() => undefined} />)
}

describe('ConsoleTabStrip badge', () => {
  it('renders the pending count as a badge element', () => {
    const html = render([
      { id: 'approvals', label: '审批', badge: 3 },
      { id: 'tickets', label: '工单' },
    ])

    expect(html).toContain('class="pa-console__badge"')
    expect(html).toContain('>3<')
  })

  it('keeps a large count compact', () => {
    const html = render([{ id: 'approvals', label: '审批', badge: 120 }])

    expect(html).toContain('>99+<')
  })

  it('renders no badge for zero or an absent count', () => {
    const html = render([
      { id: 'approvals', label: '审批', badge: 0 },
      { id: 'tickets', label: '工单' },
    ])

    expect(html).not.toContain('pa-console__badge')
  })
})
