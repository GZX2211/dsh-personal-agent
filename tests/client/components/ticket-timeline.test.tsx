// tests/client/components/ticket-timeline.test.tsx
//
// 时间线是详情页的核心：三主轨常驻、右侧只放徽标与简写时间、介入虚线、
// Live 多绿点、点击展开与事件流。这里用静态渲染验证可观察结构。

import { describe, expect, it, vi } from 'vitest'

vi.mock('@deepseek-ai/dsh-client-ui-primitives', async () => await import('../../support/ui-primitives-stub.tsx'))

import { renderToStaticMarkup } from 'react-dom/server'
import type { RefObject } from 'react'
import type {
  AgentLaneView,
  ChainRow,
  TicketDetailResponse,
} from '../../../src/shared/ticket-detail.ts'
import { translateFor } from '../../../src/client/i18n.ts'
import { SwimTimeline } from '../../../src/client/components/ticket/SwimTimeline.tsx'
import { NO_ACTIONS } from '../../../src/client/actions.ts'

const t = translateFor('zh')
const NOW = new Date(2026, 10, 22, 9, 30).getTime()
const ROUTER = 'router'
const HUMAN = 'human'
const WORKER = 'session-worker'
const REVIEWER = 'session-reviewer'

const scrollRef = { current: null } as RefObject<HTMLElement | null>

function lane(
  id: string,
  index: number,
  role: AgentLaneView['role'],
  extra: Partial<AgentLaneView> = {},
): AgentLaneView {
  return { id, index, role, status: 'idle', ...extra }
}

const LANES: AgentLaneView[] = [
  lane(ROUTER, 0, 'router'),
  lane(HUMAN, 1, 'human'),
  lane(WORKER, 2, 'lead', { name: 'lead', sessionId: WORKER, status: 'running', currentTurn: 2 }),
  lane(REVIEWER, 3, 'subagent', { name: 'reviewer', sessionId: REVIEWER, parentId: WORKER }),
]

function rows(): ChainRow[] {
  return [
    {
      id: 'dispatch',
      at: NOW + 1_000,
      kind: 'dispatch',
      from: ROUTER,
      to: WORKER,
      mode: 'dispatch',
      summary: '修复接口契约',
      text: '修复 /v1 工单接口契约不一致',
      anchor: { sessionId: WORKER, seq: 3 },
    },
    {
      id: 'hop',
      at: NOW + 2_000,
      kind: 'hop',
      from: WORKER,
      to: REVIEWER,
      direction: 'down',
      summary: '复核契约',
      text: '帮我复核 POST /v1 的字段名',
      anchor: { sessionId: REVIEWER, seq: 7 },
    },
    {
      id: 'intervene',
      at: NOW + 3_000,
      kind: 'intervene',
      from: HUMAN,
      to: WORKER,
      summary: '回归包含 v1 兼容',
      text: '回归范围包含 v1 兼容',
      anchor: { sessionId: WORKER, seq: 9 },
    },
    {
      id: 'supplement',
      at: NOW + 3_500,
      kind: 'supplement',
      from: ROUTER,
      to: WORKER,
      summary: '转发新事实',
      text: 'CI 上有一条 v1 兼容失败',
    },
    {
      id: 'approval',
      at: NOW + 4_000,
      kind: 'approval',
      phase: 'request',
      from: WORKER,
      to: HUMAN,
      summary: '要不要发布？',
      options: ['发布', '等等'],
    },
    {
      id: 'close',
      at: NOW + 5_000,
      kind: 'milestone',
      milestone: 'closed',
      lane: WORKER,
    },
    {
      id: 'live',
      at: NOW + 6_000,
      kind: 'live',
      lane: WORKER,
      live: 'running',
      liveAgents: [
        { lane: WORKER, activity: '写接口', turn: 2 },
        { lane: REVIEWER, activity: '复核契约', turn: 1 },
      ],
    },
  ]
}

function detail(overrides: Partial<TicketDetailResponse> = {}): TicketDetailResponse {
  return {
    ticket: {
      id: 't-abcdef1234',
      shortId: 'abcdef',
      title: '修复 /v1 工单接口契约不一致',
      stage: 'running',
      goal: '把契约修好',
      createdAt: NOW,
      updatedAt: NOW,
      dispatchedAt: NOW + 1_000,
      workerSessionId: WORKER,
    },
    mode: 'dispatch',
    origin: {
      signal: { kind: 'perception', text: '「接口契约测试报告」发生变化', receivedAt: NOW - 1_000 },
    },
    lanes: LANES,
    rows: rows(),
    delivery: {},
    metrics: {
      agents: 2,
      hops: 1,
      supplements: 0,
      parallel: 0,
      pingPong: 0,
      turns: 2,
      tokens: 1_000,
      durationMs: 5_000,
    },
    completeness: { logs: 'full' },
    generatedAt: NOW + 6_000,
    ...overrides,
  }
}

function render(
  view: 'swim' | 'stream' = 'swim',
  overrides: Partial<Parameters<typeof SwimTimeline>[0]> = {},
): string {
  return renderToStaticMarkup(
    <SwimTimeline
      t={t}
      language="zh"
      detail={detail()}
      actions={NO_ACTIONS}
      onToggleRow={() => undefined}
      onFocusLane={() => undefined}
      view={view}
      onViewChange={() => undefined}
      moreExpanded={false}
      onToggleMore={() => undefined}
      scrollRef={scrollRef}
      {...overrides}
    />,
  )
}

describe('SwimTimeline', () => {
  it('always shows Router, the human and the worker as the three main lanes', () => {
    const html = render()

    expect(html).toContain('>Router<')
    expect(html).toContain('>你<')
    expect(html).toContain('>lead<')
    expect(html).toContain('>reviewer<')
    expect(html).toContain('pa-lane__role')
  })

  it('falls back to three core lanes when an older Host omits Router', () => {
    const html = render('swim', {
      detail: detail({
        lanes: [
          { id: HUMAN, index: 0, role: 'human', status: 'idle' },
          { id: WORKER, index: 1, role: 'lead', status: 'running', name: 'lead', sessionId: WORKER },
        ],
        rows: [rows()[0]!],
      }),
    })

    expect(html).toContain('>Router<')
    expect(html).toContain('>你<')
    expect(html).toContain('>lead<')
    expect(html).toContain('pa-rail__edge')
    expect(html).toContain('派发')
  })

  it('keeps only the type badge and short time on the right side of a row', () => {
    const html = render()

    expect(html).toContain('>派发<')
    expect(html).toContain('>委派<')
    expect(html).toContain('>介入<')
    expect(html).toContain('>审批<')
    expect(html).toContain('>结束<')
    expect(html).not.toContain('Router → lead')
    expect(html).not.toContain('修复 /v1 工单接口契约不一致')
  })

  it('draws the intervention as a dashed straight edge', () => {
    const html = render()

    expect(html).toContain('pa-rail__edge')
    expect(html).toContain('stroke-dasharray="3 3"')
    expect(html).toContain('pa-rail__node--dashed')
  })

  it('shows the origin row and the handoff counts in the card head', () => {
    const html = render()

    expect(html).toContain('「接口契约测试报告」发生变化')
    expect(html).toContain('5 次交接')
    expect(html).toContain('交接时间线')
  })

  it('puts the handoff count before a compact view switch at the right edge', () => {
    const html = render()

    expect(html.indexOf('pa-timeline__meta')).toBeLessThan(html.indexOf('pa-timeline__view'))
    expect(html).toContain('pa-timeline__view-tab')
  })

  it('expands the selected row inline with full text and session actions', () => {
    const html = render('swim', { selectedRowId: 'hop' })

    expect(html).toContain('帮我复核 POST /v1 的字段名')
    expect(html).toContain('打开 reviewer 会话')
    expect(html).toContain('打开 lead 会话')
    expect(html).toContain('aria-expanded="true"')
  })

  it('renders one green dot per running agent and rotates their activity text', () => {
    const html = render()

    expect(html).toContain('pa-rail__live-core')
    expect(html.match(/pa-rail__live-core/g)).toHaveLength(2)
    expect(html).toContain('等待中 · lead 写接口')
    expect(html).toContain('等待中 · reviewer 复核契约')
  })

  it('waits for approval without painting green dots', () => {
    const html = render('swim', {
      detail: detail({
        rows: [
          {
            id: 'approval',
            at: NOW + 4_000,
            kind: 'approval',
            phase: 'request',
            from: WORKER,
            to: HUMAN,
            summary: '要不要发布？',
            options: ['发布', '等等'],
          },
          {
            id: 'live',
            at: NOW + 5_000,
            kind: 'live',
            lane: HUMAN,
            live: 'waiting-approval',
            waitingOn: WORKER,
          },
        ],
      }),
    })

    expect(html).toContain('等待审批 · 要不要发布？')
    expect(html).not.toContain('pa-rail__live-core')
  })

  it('switches to the event stream and keeps handoffs only', () => {
    const html = render('stream')

    expect(html).toContain('pa-stream__row')
    expect(html).toContain('派发')
    expect(html).toContain('介入')
    expect(html).not.toContain('pa-rail__live-core')
    expect(html).not.toContain('等待中 · lead 写接口')
  })

  it('paints a failed milestone red', () => {
    const html = render('swim', {
      detail: detail({
        rows: [{ id: 'failed', at: NOW + 5_000, kind: 'milestone', milestone: 'failed', lane: WORKER }],
      }),
    })

    expect(html).toContain('失败')
    expect(html).toContain('pa-kind-fail')
  })

  it('folds subagents beyond four into a +N lane', () => {
    const many = Array.from({ length: 6 }, (_, index) =>
      lane(`session-sub-${index}`, index + 3, 'subagent', {
        name: `sub-${index}`,
        sessionId: `session-sub-${index}`,
        parentId: WORKER,
      }),
    )
    const html = render('swim', {
      detail: detail({
        lanes: [...LANES.slice(0, 3), ...many],
        rows: [],
        metrics: { ...detail().metrics, agents: 6 },
      }),
    })

    expect(html).toContain('+2')
    expect(html).toContain('sub-0')
    expect(html).not.toContain('sub-5')
  })
})
