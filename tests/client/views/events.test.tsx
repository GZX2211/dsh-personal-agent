// tests/client/views/events.test.tsx
//
// 事件页：胶囊、搜索框与信号卡片；空态按胶囊区分。

import { describe, expect, it, vi } from 'vitest'

vi.mock('@deepseek-ai/dsh-client-ui-primitives', async () => await import('../../support/ui-primitives-stub.tsx'))

import { renderToStaticMarkup } from 'react-dom/server'
import type { ComponentProps } from 'react'
import type { SnapshotResponse } from '../../../src/shared/api.ts'
import type { SignalView } from '../../../src/shared/signals.ts'
import { translateFor } from '../../../src/client/i18n.ts'
import { Events } from '../../../src/client/views/Events.tsx'

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

function signal(overrides: Partial<SignalView> = {}): SignalView {
  return {
    signalId: 's-1',
    kind: 'user-message',
    receivedAt: NOW - 60_000,
    delivered: true,
    text: '把 README 改一下',
    ...overrides,
  }
}

function render(props: Partial<ComponentProps<typeof Events>> = {}): string {
  return renderToStaticMarkup(
    <Events t={t} language="zh" snapshot={snapshot()} refresh={() => undefined} {...props} />,
  )
}

describe('Events view', () => {
  it('renders the capsules and the search box', () => {
    const html = render()

    expect(html).toContain('全部')
    expect(html).toContain('用户')
    expect(html).toContain('定时')
    expect(html).toContain('感知')
    expect(html).toContain('已过滤')
    expect(html).toContain('搜索')
  })

  it('explains an empty list', () => {
    expect(render()).toContain('还没有事件')
  })

  it('renders one card per signal', () => {
    const html = render({
      snapshot: snapshot({
        signals: [
          signal({ signalId: 's-1' }),
          signal({
            signalId: 's-2',
            kind: 'perception',
            text: 'app.yml 被修改',
            sourceName: '配置文件',
            threadName: '变更',
            decision: { action: 'reply', at: NOW },
          }),
          signal({
            signalId: 's-3',
            kind: 'timer',
            text: '该喝水了',
            sourceName: '喝水提醒',
            delivered: false,
            rule: 'min-gap',
          }),
        ],
      }),
    })

    expect(html).toContain('把 README 改一下')
    expect(html).toContain('配置文件 · 变更')
    expect(html).toContain('该喝水了')
    expect(html).toContain('已过滤 · 节流')
  })

  it('makes a dispatch verdict clickable when a ticket opener is provided', () => {
    const html = render({
      snapshot: snapshot({
        signals: [
          signal({
            signalId: 's-1',
            kind: 'perception',
            text: '工单结束',
            decision: { action: 'dispatch', ticketId: 't-9c20e78bca', at: NOW },
          }),
        ],
      }),
      onOpenTicket: () => undefined,
    })

    expect(html).toContain('派发 #9c20e7')
    expect(html).toContain('data-primitive="button"')
  })

  it('shows the connection banner when the snapshot cannot be read', () => {
    expect(render({ error: 'ledger unavailable' })).toContain('连接中断，正在重试')
  })
})
