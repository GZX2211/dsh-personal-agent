// tests/client/views/sources.test.tsx
//
// 来源页：与另外三页相同的工具栏（左侧创建按钮、右侧搜索与帮助）+ 来源卡片。
// 定时任务不在本页展示；说明文案只在帮助对话框里。

import { describe, expect, it, vi } from 'vitest'

vi.mock('@deepseek-ai/dsh-client-ui-primitives', async () => await import('../../support/ui-primitives-stub.tsx'))

import { renderToStaticMarkup } from 'react-dom/server'
import type { ComponentProps } from 'react'
import type { SnapshotResponse } from '../../../src/shared/api.ts'
import type { SourceView } from '../../../src/shared/sources.ts'
import { NO_ACTIONS } from '../../../src/client/actions.ts'
import { translateFor } from '../../../src/client/i18n.ts'
import { Sources } from '../../../src/client/views/Sources.tsx'

const t = translateFor('zh')

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

function source(overrides: Partial<SourceView> = {}): SourceView {
  return {
    id: 'src-1',
    name: '本地文件',
    enabled: true,
    channelKind: 'fs-watch',
    config: { kind: 'fs-watch', paths: ['D:/watch'], recursive: false },
    status: 'running',
    threads: [{ id: 'changes', name: '变更', enabled: true, deliveredCount: 0, filteredCount: 0 }],
    deliveredCount: 0,
    filteredCount: 0,
    ...overrides,
  }
}

function render(props: Partial<ComponentProps<typeof Sources>> = {}): string {
  return renderToStaticMarkup(
    <Sources
      t={t}
      language="zh"
      snapshot={snapshot()}
      refresh={() => undefined}
      actions={NO_ACTIONS}
      {...props}
    />,
  )
}

describe('Sources view', () => {
  it('explains the empty list without a visible intro block', () => {
    const html = render()

    expect(html).toContain('还没有感知来源')
    expect(html).not.toContain('感知来源让 Agent 在你不在场时也能收到通知')
  })

  it('carries the same toolbar as the other pages', () => {
    const html = render()

    expect(html).toContain('在对话中创建')
    expect(html).toContain('pa-toolbar__search')
    expect(html).toContain('帮助')
  })

  it('lists a source card', () => {
    const html = render({ snapshot: snapshot({ sources: [source()] }) })

    expect(html).toContain('本地文件')
    expect(html).toContain('运行中')
    expect(html).toContain('线程 1')
  })

  it('does not render the timer section any more', () => {
    const html = render()

    expect(html).not.toContain('定时来源')
    expect(html).not.toContain('打开自动化任务')
  })

  it('disables creating in conversation when the router session is unknown', () => {
    const withoutRouter = render({ snapshot: snapshot({ sources: [source()] }) })
    const withRouter = render({
      snapshot: snapshot({ sources: [source()], routerSessionId: 'session-router' }),
    })

    expect(withoutRouter).toMatch(/<button[^>]*disabled=""[^>]*>在对话中创建</)
    expect(withRouter).not.toMatch(/<button[^>]*disabled=""[^>]*>在对话中创建</)
  })

  it('shows the connection banner with a retry action', () => {
    const html = render({ error: 'ledger unavailable' })

    expect(html).toContain('连接中断，正在重试')
    expect(html).toContain('立即重试')
  })

  it('does not render a toast until an action finishes', () => {
    expect(render()).not.toContain('data-primitive="toast"')
  })
})
