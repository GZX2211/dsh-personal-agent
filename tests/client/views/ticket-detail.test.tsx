// tests/client/views/ticket-detail.test.tsx
//
// 详情页主体：头部元信息、调用链的行与 chips、交付卡、折叠的会话与目录。
// 断言落在用户能读到的内容上（短码、阶段、行文案、汇报全文）。

import { describe, expect, it, vi } from 'vitest'

vi.mock('@deepseek-ai/dsh-client-ui-primitives', async () => await import('../../support/ui-primitives-stub.tsx'))

import { renderToStaticMarkup } from 'react-dom/server'
import type { ComponentProps } from 'react'
import type { AgentLaneView, ChainRow, TicketDetailResponse } from '../../../src/shared/ticket-detail.ts'
import type { TicketView } from '../../../src/shared/tickets.ts'
import { translateFor } from '../../../src/client/i18n.ts'
import { TicketDetailView } from '../../../src/client/views/TicketDetail.tsx'

const t = translateFor('zh')
const BASE = 1_700_000_000_000
const TICKET_ID = 't-abcdef1234'

function ticket(overrides: Partial<TicketView> = {}): TicketView {
  return {
    id: TICKET_ID,
    shortId: 'abcdef',
    title: '发布 v2',
    stage: 'running',
    goal: '把 v2 发出去',
    createdAt: BASE,
    updatedAt: BASE,
    dispatchedAt: BASE + 1000,
    workerSessionId: 'session-worker',
    directory: 'D:/pa/work/t-abcdef1234',
    ...overrides,
  }
}

function lane(overrides: Partial<AgentLaneView> & Pick<AgentLaneView, 'id' | 'index' | 'role'>): AgentLaneView {
  return { status: 'idle', ...overrides }
}

function rows(): ChainRow[] {
  return [
    {
      id: 'dispatch:1',
      kind: 'dispatch',
      at: BASE + 1000,
      from: 'router',
      to: 'session-worker',
      mode: 'dispatch',
      summary: '[工单] #abcdef 发布 v2',
      anchor: { sessionId: 'session-worker', seq: 3 },
    },
    {
      id: 'hop:2',
      kind: 'hop',
      at: BASE + 2000,
      from: 'session-worker',
      to: 'session-reviewer',
      direction: 'down',
      summary: '帮我复核接口契约',
      text: '帮我复核接口契约\n顺便看下错误码',
    },
    {
      id: 'supplement:3',
      kind: 'supplement',
      at: BASE + 2500,
      from: 'router',
      to: 'session-worker',
      summary: '契约改了',
      text: '契约改了',
    },
    { id: 'live:4', kind: 'live', at: BASE + 3000, lane: 'session-worker', live: 'running', turn: 2 },
  ]
}

function detail(overrides: Partial<TicketDetailResponse> = {}): TicketDetailResponse {
  return {
    ticket: ticket(),
    mode: 'dispatch',
    origin: {
      signal: {
        kind: 'perception',
        text: 'app.yml 被改成 v2 的端口',
        sourceName: '配置文件',
        threadName: '变更',
        receivedAt: BASE,
      },
      decision: { action: 'dispatch', at: BASE + 2 },
      requestedBySessionId: 'session-router',
    },
    lanes: [
      lane({ id: 'router', index: 0, role: 'router', sessionId: 'session-router' }),
      lane({ id: 'session-worker', index: 1, role: 'lead', name: 'lead', status: 'running', currentTurn: 2, sessionId: 'session-worker' }),
      lane({
        id: 'session-reviewer',
        index: 2,
        role: 'subagent',
        name: 'reviewer',
        parentId: 'session-worker',
        sessionId: 'session-reviewer',
      }),
    ],
    rows: rows(),
    delivery: { report: 'v2 已上线，回归通过', expectedOutput: '生产返回 200' },
    metrics: {
      agents: 2,
      hops: 1,
      supplements: 1,
      parallel: 0,
      pingPong: 0,
      turns: 3,
      tokens: 1234,
      durationMs: 90_000,
    },
    completeness: { logs: 'full' },
    generatedAt: BASE + 3000,
    ...overrides,
  }
}

function render(props: Partial<ComponentProps<typeof TicketDetailView>> = {}): string {
  return renderToStaticMarkup(
    <TicketDetailView
      t={t}
      language="zh"
      detail={detail()}
      onBack={() => undefined}
      onOpenSession={() => undefined}
      {...props}
    />,
  )
}

describe('TicketDetailView', () => {
  it('heads the page with the ticket identity and its numbers', () => {
    const html = render()

    expect(html).toContain('工单 #abcdef')
    expect(html).toContain('进行中')
    expect(html).toContain('发布 v2')
    expect(html).toContain('负责人')
    expect(html).toContain('lead')
    // 投递 1、补充 1、时长 1 分 30 秒。
    expect(html).toContain('1 分 30 秒')
    expect(html).toContain('打开会话')
  })

  it('explains where the ticket came from', () => {
    const html = render()

    expect(html).toContain('感知')
    expect(html).toContain('app.yml 被改成 v2 的端口')
    expect(html).toContain('派发')
  })

  it('renders the chain rows and the lane chips', () => {
    const html = render()

    expect(html).toContain('调用链')
    expect(html).toContain('1 投递 · 1 补充')
    expect(html).toContain('pa-chip__index')
    expect(html).toContain('路由')
    expect(html).toContain('reviewer')
    expect(html).toContain('[工单] #abcdef 发布 v2')
    expect(html).toContain('帮我复核接口契约')
    expect(html).toContain('契约改了')
    expect(html).toContain('正在第 2 轮')
    // 行是按钮，折叠时不渲染展开内容。
    expect(html).toContain('aria-expanded="false"')
    expect(html).not.toContain('pa-chain-edge')
  })

  it('expands a row in place with facts and a possible impact range', () => {
    const html = render({ initialExpandedId: 'hop:2' })

    expect(html).toContain('pa-chain-edge')
    expect(html).toContain('收到后它做了什么')
    expect(html).toContain('可能由它引起')
    expect(html).toContain('顺便看下错误码')
    expect(html).toContain('在 reviewer 会话定位')
    expect(html).toContain('aria-expanded="true"')
  })

  it('carries the report and the acceptance criteria', () => {
    const html = render()

    expect(html).toContain('交付')
    expect(html).toContain('v2 已上线，回归通过')
    expect(html).toContain('生产返回 200')
    // 四个指标：轮次 / 投递 / 时长 / token。
    expect(html).toContain('>轮次<')
    expect(html).toContain('>1234<')
  })

  it('says so when nothing has been reported yet', () => {
    const html = render({ detail: detail({ delivery: {} }) })

    expect(html).toContain('尚未汇报')
  })

  it('shows a queued ticket without a chain', () => {
    const html = render({
      detail: detail({
        ticket: ticket({
          stage: 'queued',
          dispatchedAt: undefined,
          workerSessionId: undefined,
          queueReason: 'capacity-full',
        }),
        lanes: [lane({ id: 'router', index: 0, role: 'router', sessionId: 'session-router' })],
        rows: [
          {
            id: 'milestone:1',
            kind: 'milestone',
            at: BASE + 1,
            milestone: 'queue-capacity',
          },
        ],
        delivery: {},
      }),
    })

    expect(html).toContain('待处理')
    expect(html).toContain('执行名额已满')
  })

  it('warns when the session logs could not be read', () => {
    const html = render({ detail: detail({ completeness: { logs: 'unavailable' } }) })

    expect(html).toContain('会话日志不可读')
  })

  it('marks an appended ticket as reusing a session and a failed one as failed', () => {
    const html = render({
      detail: detail({
        mode: 'append',
        ticket: ticket({
          stage: 'ended',
          endedAt: BASE + 6000,
          outcome: 'failed',
          report: '构建失败',
        }),
        delivery: { report: '构建失败', outcome: 'failed', reason: 'turn-failed' },
      }),
    })

    expect(html).toContain('复用会话')
    expect(html).toContain('已结束')
    expect(html).toContain('turn-failed')
    expect(html).toContain('构建失败')
  })

  it('folds the sessions and the working directory', () => {
    const html = render()

    expect(html).toContain('会话与目录')
    expect(html).toContain('D:/pa/work/t-abcdef1234')
  })
})
