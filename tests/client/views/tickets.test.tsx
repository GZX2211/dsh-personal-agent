// tests/client/views/tickets.test.tsx
//
// 工单页：列表按最新更新排在最上面，默认落在「进行中」胶囊。

import { describe, expect, it, vi } from 'vitest'

vi.mock('@deepseek-ai/dsh-client-ui-primitives', async () => await import('../../support/ui-primitives-stub.tsx'))

import { renderToStaticMarkup } from 'react-dom/server'
import type { ComponentProps } from 'react'
import type { SnapshotResponse } from '../../../src/shared/api.ts'
import type { TicketView } from '../../../src/shared/tickets.ts'
import { translateFor } from '../../../src/client/i18n.ts'
import { Tickets } from '../../../src/client/views/Tickets.tsx'

const t = translateFor('zh')
const NOW = 1_700_000_000_000

function snapshot(overrides: Partial<SnapshotResponse> = {}): SnapshotResponse {
  return {
    tickets: [],
    approvals: [],
    signals: [],
    sources: [],
    timers: [],
    stats: {
      tickets: { queued: 0, running: 0, blocked: 0, ended: 0, total: 0 },
      approvals: { pending: 0, decided: 0 },
      signals: { delivered: 0, filtered: 0, total: 0 },
    },
    ...overrides,
  }
}

function ticket(overrides: Partial<TicketView> = {}): TicketView {
  return {
    id: 't-1',
    shortId: '1',
    title: '工单',
    stage: 'running',
    goal: '把事做完',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

function render(props: Partial<ComponentProps<typeof Tickets>> = {}): string {
  return renderToStaticMarkup(
    <Tickets t={t} language="zh" snapshot={snapshot()} {...props} />,
  )
}

describe('Tickets view', () => {
  it('puts the most recently updated ticket first', () => {
    const html = render({
      snapshot: snapshot({
        tickets: [
          ticket({ id: 't-old', shortId: 'old', title: '更早更新的工单', updatedAt: NOW }),
          ticket({ id: 't-new', shortId: 'new', title: '刚刚更新的工单', updatedAt: NOW + 60_000 }),
        ],
      }),
    })

    expect(html.indexOf('刚刚更新的工单')).toBeLessThan(html.indexOf('更早更新的工单'))
  })

  it('explains an empty running list', () => {
    expect(render()).toContain('没有进行中的工单')
  })

  it('keeps the toolbar and search box of the other pages', () => {
    const html = render()

    expect(html).toContain('待处理')
    expect(html).toContain('进行中')
    expect(html).toContain('pa-toolbar__search')
  })
})
