// tests/client/panel/console-panel.test.tsx
//
// 总控台默认落在概览：标签条仍在，审批仍带待处理徽标；概览首屏是骨架，
// 不再是「暂未开放」占位。

import { describe, expect, it, vi } from 'vitest'

vi.mock('@deepseek-ai/dsh-client-ui-primitives', async () => await import('../../support/ui-primitives-stub.tsx'))

import { renderToStaticMarkup } from 'react-dom/server'
import { translateFor } from '../../../src/client/i18n.ts'
import { ConsolePanel } from '../../../src/client/panel/ConsolePanel.tsx'

describe('ConsolePanel', () => {
  it('lands on the overview tab by default', () => {
    const html = renderToStaticMarkup(<ConsolePanel t={translateFor('zh')} language="zh" />)

    expect(html).toMatch(/aria-selected="true"[^>]*>概览</)
    expect(html).toContain('aria-busy="true"')
    expect(html).toContain('pa-overview')
  })

  it('keeps every tab, including approvals', () => {
    const html = renderToStaticMarkup(<ConsolePanel t={translateFor('zh')} language="zh" />)

    expect(html).toContain('>概览<')
    expect(html).toContain('>审批<')
    expect(html).toContain('>工单<')
    expect(html).toContain('>事件<')
    expect(html).toContain('>来源<')
    expect(html).toContain('>设置<')
    expect(html).not.toContain('暂未开放')
  })
})
