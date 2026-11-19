// tests/client/views/sources.test.tsx
//
// 来源页：说明条、感知来源分区、只读定时分区与两种空态。
// 写操作在页面内是异步的，这里只验证「呈现出来的事实」。

import { describe, expect, it, vi } from 'vitest'

vi.mock('@deepseek-ai/dsh-client-ui-primitives', async () => await import('../../support/ui-primitives-stub.tsx'))

import { renderToStaticMarkup } from 'react-dom/server'
import type { ComponentProps } from 'react'
import type { SnapshotResponse } from '../../../src/shared/api.ts'
import type { SourceView, TimerSourceView } from '../../../src/shared/sources.ts'
import { NO_ACTIONS } from '../../../src/client/actions.ts'
import { translateFor } from '../../../src/client/i18n.ts'
import { Sources } from '../../../src/client/views/Sources.tsx'

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

function timer(overrides: Partial<TimerSourceView> = {}): TimerSourceView {
  return {
    scheduleId: 'schedule-1',
    title: '每天提醒',
    active: true,
    timing: { kind: 'every', everySeconds: 300 },
    nextAt: NOW + 5 * 60_000,
    deliveredCount: 2,
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
  it('explains both empty sections', () => {
    const html = render()

    expect(html).toContain('感知来源让 Agent 在你不在场时也能收到通知')
    expect(html).toContain('还没有感知来源')
    expect(html).toContain('还没有投递到个人代理的定时任务')
  })

  it('lists a source and a timer', () => {
    const html = render({
      snapshot: snapshot({ sources: [source()], timers: [timer()] }),
    })

    expect(html).toContain('本地文件')
    expect(html).toContain('运行中')
    expect(html).toContain('每天提醒')
    expect(html).toContain('周期 · 5分钟')
    expect(html).toContain('已投递 2')
    expect(html).toContain('打开自动化任务')
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
