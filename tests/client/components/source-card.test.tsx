// tests/client/components/sourceCard.test.tsx
//
// 来源卡片：折叠时一行讲清楚「在盯什么、状态如何、最近什么时候动过」；
// 展开后才出现线程开关、配置摘要与测试/删除。

import { describe, expect, it, vi } from 'vitest'

vi.mock('@deepseek-ai/dsh-client-ui-primitives', async () => await import('../../support/ui-primitives-stub.tsx'))

import { renderToStaticMarkup } from 'react-dom/server'
import type { ComponentProps } from 'react'
import type { SignalView } from '../../../src/shared/signals.ts'
import type { SourceThreadView, SourceView } from '../../../src/shared/sources.ts'
import { SourceCard } from '../../../src/client/components/SourceCard.tsx'
import { translateFor } from '../../../src/client/i18n.ts'

const t = translateFor('zh')
const NOW = 1_700_000_000_000

function thread(overrides: Partial<SourceThreadView> = {}): SourceThreadView {
  return {
    id: 'changes',
    name: '变更',
    enabled: true,
    deliveredCount: 2,
    filteredCount: 1,
    lastEventAt: NOW - 5 * 60_000,
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
    threads: [thread(), thread({ id: 'errors', name: '错误', enabled: false })],
    deliveredCount: 3,
    filteredCount: 1,
    lastEventAt: NOW - 5 * 60_000,
    ...overrides,
  }
}

function signal(overrides: Partial<SignalView> = {}): SignalView {
  return {
    signalId: 's-1',
    kind: 'perception',
    receivedAt: NOW - 60_000,
    delivered: true,
    text: '[test] change D:/watch',
    ...overrides,
  }
}

function render(props: Partial<ComponentProps<typeof SourceCard>> = {}): string {
  return renderToStaticMarkup(
    <SourceCard
      t={t}
      language="zh"
      now={NOW}
      source={source()}
      enabled
      threadEnabled={{}}
      busy={false}
      deleting={false}
      onToggleSource={() => undefined}
      onToggleThread={() => undefined}
      onTest={() => undefined}
      onRestart={() => undefined}
      onRemove={() => undefined}
      {...props}
    />,
  )
}

describe('SourceCard', () => {
  it('summarizes the source while collapsed', () => {
    const html = render()

    expect(html).toContain('>本地文件</h3>')
    expect(html).toContain('运行中')
    expect(html).toContain('data-state="done"')
    expect(html).toContain('线程 2')
    expect(html).toContain('5分钟前')
    expect(html).not.toContain('pa-row__detail')
    expect(html).not.toContain('测试')
  })

  it('lists the threads and the config summary once expanded', () => {
    const html = render({ defaultCollapsed: false })

    expect(html).toContain('变更')
    expect(html).toContain('错误')
    expect(html).toContain('投递 2 · 过滤 1')
    expect(html).toContain('路径')
    expect(html).toContain('D:/watch')
    expect(html).toContain('role="switch"')
    expect(html).toContain('aria-checked="false"')
  })

  it('offers test and delete actions when expanded', () => {
    const html = render({ defaultCollapsed: false })

    expect(html).toContain('测试')
    expect(html).toContain('删除')
    // 错误态才提供重启。
    expect(html).not.toContain('重启')
    // 二次确认默认不打开。
    expect(html).not.toContain('role="dialog"')
  })

  it('shows the failure and a restart action for an errored source', () => {
    const html = render({
      defaultCollapsed: false,
      source: source({ status: 'error', lastError: '路径不存在：D:/watch' }),
    })

    expect(html).toContain('错误')
    expect(html).toContain('路径不存在：D:/watch')
    expect(html).toContain('重启')
  })

  it('renders the latest signals of a test run', () => {
    const html = render({
      defaultCollapsed: false,
      testResult: [signal(), signal({ signalId: 's-2', text: '第二条' })],
    })

    expect(html).toContain('最近信号')
    expect(html).toContain('[test] change D:/watch')
    expect(html).toContain('第二条')
  })

  it('explains an empty test result', () => {
    expect(render({ defaultCollapsed: false, testResult: [] })).toContain('测试没有产生新信号。')
  })

  it('reflects the enabled state and the busy state on the switch', () => {
    const stopped = render({ enabled: false })
    const busy = render({ busy: true })

    expect(stopped).toContain('aria-checked="false"')
    expect(busy).toContain('disabled=""')
  })

  it('counts the threads from the source definition, not from the counts', () => {
    const html = render({
      source: source({
        threads: [thread({ id: 'a', name: '甲' }), thread({ id: 'b', name: '乙' }), thread({ id: 'c', name: '丙' })],
      }),
    })

    expect(html).toContain('线程 3')
  })
})
