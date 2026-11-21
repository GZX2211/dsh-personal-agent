// tests/client/views/overview.test.tsx
//
// 概览页：静态渲染覆盖加载、空态、注意力、Worker 舰队、今日与错误分支。
// 交互（点击跳转）靠纯选择器的 target 测试与手动矩阵验证。

import { describe, expect, it, vi } from 'vitest'

vi.mock('@deepseek-ai/dsh-client-ui-primitives', async () => await import('../../support/ui-primitives-stub.tsx'))

import { renderToStaticMarkup } from 'react-dom/server'
import type { ComponentProps } from 'react'
import type { SnapshotResponse } from '../../../src/shared/api.ts'
import type { ApprovalView } from '../../../src/shared/approvals.ts'
import type { DayActivity, WorkerRuntimeView } from '../../../src/shared/runtime.ts'
import type { SourceView, TimerSourceView } from '../../../src/shared/sources.ts'
import type { TicketView } from '../../../src/shared/tickets.ts'
import { translateFor } from '../../../src/client/i18n.ts'
import { formatDayLabel } from '../../../src/client/lib/format.ts'
import { Overview } from '../../../src/client/views/Overview.tsx'

const t = translateFor('zh')
const NOW = new Date(2026, 10, 21, 12, 0, 0).getTime()
const TODAY_START = new Date(2026, 10, 21, 0, 0, 0).getTime()
const MINUTE = 60_000

function snapshotOf(overrides: Partial<SnapshotResponse> = {}): SnapshotResponse {
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

function ticketOf(overrides: Partial<TicketView> = {}): TicketView {
  return {
    id: 't-aaa1112223',
    shortId: 'aaa111',
    title: '修复登录超时',
    stage: 'running',
    goal: '把登录修好',
    workerSessionId: 'session-1',
    createdAt: NOW - 10 * MINUTE,
    dispatchedAt: NOW - 5 * MINUTE,
    updatedAt: NOW - MINUTE,
    ...overrides,
  }
}

function approvalOf(overrides: Partial<ApprovalView> = {}): ApprovalView {
  return {
    id: 'a-1',
    ticketId: 't-aaa1112223',
    question: '发布到生产会立刻影响用户。',
    options: [{ label: '发布', description: '立刻上线' }],
    requestedBySessionId: 'session-1',
    createdAt: NOW - 4 * MINUTE,
    ...overrides,
  }
}

function workerOf(overrides: Partial<WorkerRuntimeView> = {}): WorkerRuntimeView {
  return {
    ticketId: 't-aaa1112223',
    workerSessionId: 'session-1',
    live: 'running',
    turn: 3,
    lastActivityAt: NOW - 2 * MINUTE,
    ...overrides,
  }
}

function sourceOf(overrides: Partial<SourceView> = {}): SourceView {
  return {
    id: 'src-1',
    name: '线上日志',
    enabled: true,
    channelKind: 'fs-watch',
    config: { kind: 'fs-watch', paths: ['D:/tmp/a.txt'], recursive: false },
    status: 'running',
    threads: [],
    deliveredCount: 0,
    filteredCount: 0,
    ...overrides,
  }
}

function timerOf(overrides: Partial<TimerSourceView> = {}): TimerSourceView {
  return {
    scheduleId: 'schedule-1',
    title: '每日汇总',
    active: true,
    timing: { kind: 'daily', time: '09:00', timeZone: 'Asia/Shanghai' },
    deliveredCount: 0,
    ...overrides,
  }
}

function daysOf(totals: readonly { delivered: number; filtered: number }[]): DayActivity[] {
  return totals.map((total, index) => ({
    start: TODAY_START - (6 - index) * 24 * 3_600_000,
    ...total,
  }))
}

const actions = {
  openSession: vi.fn(),
  openFile: vi.fn(),
  sessionTitle: () => undefined,
}

function render(props: Partial<ComponentProps<typeof Overview>> = {}): string {
  return renderToStaticMarkup(
    <Overview
      t={t}
      language="zh"
      refresh={() => undefined}
      actions={actions}
      onNavigate={() => undefined}
      now={NOW}
      {...props}
    />,
  )
}

describe('Overview view', () => {
  it('shows a skeleton while the first snapshot is loading', () => {
    const html = render()

    expect(html).toContain('aria-busy="true"')
    expect(html).toContain('加载中')
    expect(html).not.toContain('今天')
  })

  it('guides a fresh install instead of rendering a wall of zeros', () => {
    const html = render({ snapshot: snapshotOf() })

    expect(html).toContain('还没有任何活动')
    expect(html).toContain('去来源页')
    expect(html).toContain('Router 会话未就绪')
    expect(html).not.toContain('今天')
  })

  it('summarizes pending approvals with wait, risk and held slots', () => {
    const html = render({
      snapshot: snapshotOf({
        routerSessionId: 'router-1',
        approvals: [approvalOf({ risk: 'high' })],
        tickets: [ticketOf({ stage: 'blocked' })],
        workers: [workerOf({ live: 'idle', turn: 2 })],
        stats: {
          tickets: { queued: 0, running: 0, blocked: 1, ended: 0, total: 1 },
          approvals: { pending: 1, decided: 0 },
          signals: { delivered: 0, filtered: 0, total: 0 },
        },
      }),
    })

    expect(html).toContain('1 条审批等你处理')
    expect(html).toContain('已等待 4分钟')
    expect(html).toContain('最高风险 高')
    expect(html).toContain('占用 1 个执行槽位')
    expect(html).toContain('等待审批')
    expect(html).toContain('已等 4分钟')
  })

  it('folds attention beyond the first two items', () => {
    const html = render({
      snapshot: snapshotOf({
        routerSessionId: 'router-1',
        approvals: [approvalOf()],
        sources: [sourceOf({ status: 'error' })],
        tickets: [ticketOf()],
        workers: [workerOf({ live: 'offline' })],
        stats: {
          tickets: { queued: 0, running: 1, blocked: 0, ended: 0, total: 1 },
          approvals: { pending: 1, decided: 0 },
          signals: { delivered: 0, filtered: 0, total: 0 },
        },
      }),
    })

    expect(html).toContain('另有 1 项')
  })

  it('renders the worker fleet with turn, context and last activity', () => {
    const html = render({
      snapshot: snapshotOf({
        capacity: { maxWorkers: 5 },
        tickets: [ticketOf()],
        workers: [
          workerOf({
            turn: 3,
            context: { usedTokens: 672_000, windowTokens: 1_000_000 },
          }),
        ],
        stats: {
          tickets: { queued: 0, running: 1, blocked: 0, ended: 0, total: 1 },
          approvals: { pending: 0, decided: 0 },
          signals: { delivered: 0, filtered: 0, total: 0 },
        },
      }),
    })

    expect(html).toContain('进行中')
    expect(html).toContain('1 / 5')
    expect(html).toContain('修复登录超时')
    expect(html).toContain('工单 #aaa111')
    expect(html).toContain('第 3 轮')
    expect(html).toContain('84%')
    expect(html).toContain('上次请求 67.2万 / 80万')
    expect(html).toContain('2分钟前')
  })

  it('renders token-only context without a window and a dash without a request', () => {
    const withTokens = render({
      snapshot: snapshotOf({
        tickets: [ticketOf()],
        workers: [workerOf({ context: { usedTokens: 168_000 } })],
        stats: {
          tickets: { queued: 0, running: 1, blocked: 0, ended: 0, total: 1 },
          approvals: { pending: 0, decided: 0 },
          signals: { delivered: 0, filtered: 0, total: 0 },
        },
      }),
    })
    const withoutRequest = render({
      snapshot: snapshotOf({
        tickets: [ticketOf()],
        workers: [workerOf()],
        stats: {
          tickets: { queued: 0, running: 1, blocked: 0, ended: 0, total: 1 },
          approvals: { pending: 0, decided: 0 },
          signals: { delivered: 0, filtered: 0, total: 0 },
        },
      }),
    })

    expect(withTokens).toContain('16.8万')
    expect(withTokens).toContain('模型未报告窗口')
    expect(withoutRequest).toContain('上下文')
    expect(withoutRequest).toContain('—')
    expect(withoutRequest).toContain('还没有模型请求')
  })

  it('shows the offline state instead of pretending the worker runs', () => {
    const html = render({
      snapshot: snapshotOf({
        tickets: [ticketOf()],
        workers: [workerOf({ live: 'offline' })],
        stats: {
          tickets: { queued: 0, running: 1, blocked: 0, ended: 0, total: 1 },
          approvals: { pending: 0, decided: 0 },
          signals: { delivered: 0, filtered: 0, total: 0 },
        },
      }),
    })

    expect(html).toContain('会话不在线')
    expect(html).not.toContain('第 3 轮')
  })

  it('switches to a proportional capacity bar above eight slots', () => {
    const html = render({
      snapshot: snapshotOf({
        capacity: { maxWorkers: 12 },
        tickets: [ticketOf()],
        workers: [workerOf()],
        stats: {
          tickets: { queued: 0, running: 1, blocked: 0, ended: 0, total: 1 },
          approvals: { pending: 0, decided: 0 },
          signals: { delivered: 0, filtered: 0, total: 0 },
        },
      }),
    })

    expect(html).toContain('pa-overview__capacity')
    expect(html).not.toContain('<span class="pa-overview__seat"')
  })

  it('folds workers beyond the first five', () => {
    const tickets = Array.from({ length: 6 }, (_, index) =>
      ticketOf({ id: `t-${index}aaaaaa`, shortId: `${index}aaaaa`, workerSessionId: `session-${index}` }),
    )
    const workers = tickets.map((ticket, index) =>
      workerOf({ ticketId: ticket.id, workerSessionId: `session-${index}`, lastActivityAt: NOW - index * MINUTE }),
    )
    const html = render({
      snapshot: snapshotOf({
        tickets,
        workers,
        stats: {
          tickets: { queued: 0, running: 6, blocked: 0, ended: 0, total: 6 },
          approvals: { pending: 0, decided: 0 },
          signals: { delivered: 0, filtered: 0, total: 0 },
        },
      }),
    })

    expect(html).toContain('还有 1 个执行会话')
  })

  it('renders today tiles and the seven-day chart from Host aggregates', () => {
    const days = daysOf([
      { delivered: 2, filtered: 1 },
      { delivered: 0, filtered: 0 },
      { delivered: 4, filtered: 2 },
      { delivered: 1, filtered: 0 },
      { delivered: 0, filtered: 0 },
      { delivered: 3, filtered: 1 },
      { delivered: 11, filtered: 7 },
    ])
    const html = render({
      snapshot: snapshotOf({
        activity: { today: days[6] as DayActivity, days },
        approvals: [approvalOf({ id: 'a-done', decidedAt: NOW - MINUTE })],
        tickets: [ticketOf({ id: 't-done', endedAt: NOW - MINUTE, outcome: 'completed' })],
        stats: {
          tickets: { queued: 0, running: 0, blocked: 0, ended: 1, total: 1 },
          approvals: { pending: 0, decided: 1 },
          signals: { delivered: 11, filtered: 7, total: 18 },
        },
      }),
    })

    expect(html).toContain('今天')
    expect(html).toContain('已处理 1 · 待 0')
    expect(html).toContain('完成 1 · 失败 0')
    expect(html).toContain('投递 11 · 过滤 7')
    expect(html).toContain('过去 7 天的活动')
    expect(html).toContain(formatDayLabel('zh', TODAY_START))
  })

  it('hides the chart and shows a dash when activity is missing', () => {
    const html = render({
      snapshot: snapshotOf({
        routerSessionId: 'router-1',
        sources: [sourceOf({ status: 'stopped' })],
      }),
    })

    expect(html).not.toContain('过去 7 天的活动')
    expect(html).toContain('—')
  })

  it('explains an empty seven-day chart', () => {
    const days = daysOf(Array.from({ length: 7 }, () => ({ delivered: 0, filtered: 0 })))
    const html = render({
      snapshot: snapshotOf({
        activity: { today: days[6] as DayActivity, days },
        sources: [sourceOf({ status: 'stopped' })],
      }),
    })

    expect(html).toContain('过去 7 天没有事件')
  })

  it('keeps the quiet totals and source counts in the footer', () => {
    const html = render({
      snapshot: snapshotOf({
        routerSessionId: 'router-1',
        stats: {
          tickets: { queued: 0, running: 1, blocked: 0, ended: 23, total: 24 },
          approvals: { pending: 2, decided: 7 },
          signals: { delivered: 1_000, filtered: 284, total: 1_284 },
        },
        sources: [sourceOf()],
        timers: [timerOf()],
      }),
    })

    expect(html).toContain('累计 工单 24 · 审批 9 · 事件 1,284')
    expect(html).toContain('来源 1 运行中')
    expect(html).toContain('定时 1')
  })

  it('keeps the last snapshot visible behind a retry banner and marks it stale', () => {
    const html = render({
      snapshot: snapshotOf({ routerSessionId: 'router-1' }),
      error: 'snapshot failed',
    })

    expect(html).toContain('连接中断，正在重试')
    expect(html).toContain('立即重试')
    expect(html).toContain('数据可能已过期')
  })

  it('shows the banner above the skeleton when the first load fails', () => {
    const html = render({ error: 'snapshot failed' })

    expect(html).toContain('连接中断，正在重试')
    expect(html).toContain('aria-busy="true"')
  })
})
