// tests/client/views/ticket-detail.test.tsx
//
// 详情页主体：头部一行元信息、来源条、团队 chips、泳道图的行与展开、交付卡、折叠。
// 断言落在用户能读到的东西上（短码、阶段、行文案、汇报全文、数字）。

import { describe, expect, it, vi } from 'vitest'

vi.mock('@deepseek-ai/dsh-client-ui-primitives', async () => await import('../../support/ui-primitives-stub.tsx'))

import { renderToStaticMarkup } from 'react-dom/server'
import type { ComponentProps } from 'react'
import type { AgentLaneView, ChainRow, TicketDetailResponse } from '../../../src/shared/ticket-detail.ts'
import type { TicketView } from '../../../src/shared/tickets.ts'
import { translateFor } from '../../../src/client/i18n.ts'
import { TicketDetailView } from '../../../src/client/views/TicketDetail.tsx'

const t = translateFor('zh')
const BASE = new Date(2026, 10, 21, 9, 0).getTime()
const TICKET_ID = 't-abcdef1234'

function ticket(overrides: Partial<TicketView> = {}): TicketView {
  return {
    id: TICKET_ID,
    shortId: 'abcdef',
    title: '修复 /v1 工单接口契约不一致',
    stage: 'blocked',
    goal: '把 v2 发出去',
    createdAt: BASE,
    updatedAt: BASE + 12 * 60_000,
    dispatchedAt: BASE + 60_000,
    workerSessionId: 'session-lead',
    directory: 'C:\\Users\\GZX\\.dsh\\state\\personal-agent\\work\\t-abcdef1234',
    ...overrides,
  }
}

function lane(overrides: Partial<AgentLaneView> & Pick<AgentLaneView, 'id' | 'index' | 'role'>): AgentLaneView {
  return { status: 'idle', ...overrides }
}

const LANES: AgentLaneView[] = [
  lane({ id: 'human', index: 0, role: 'human' }),
  lane({ id: 'session-lead', index: 1, role: 'lead', name: 'lead', sessionId: 'session-lead', status: 'blocked' }),
  lane({
    id: 'session-rev',
    index: 2,
    role: 'subagent',
    name: 'reviewer',
    parentId: 'session-lead',
    sessionId: 'session-rev',
  }),
  lane({
    id: 'session-arch',
    index: 3,
    role: 'subagent',
    name: 'architect',
    parentId: 'session-lead',
    sessionId: 'session-arch',
  }),
]

function rows(): ChainRow[] {
  return [
    {
      id: 'dispatch:1',
      kind: 'dispatch',
      at: BASE + 60_000,
      from: 'router',
      to: 'session-lead',
      mode: 'dispatch',
      summary: '[工单] #abcdef 修复契约',
    },
    {
      id: 'fan:2',
      kind: 'fan',
      at: BASE + 120_000,
      from: 'session-lead',
      to: [
        { sessionId: 'session-rev', summary: '复核契约' },
        { sessionId: 'session-arch', summary: '改契约' },
      ],
    },
    {
      id: 'hop:3',
      kind: 'hop',
      at: BASE + 360_000,
      from: 'session-rev',
      to: 'session-lead',
      direction: 'up',
      summary: '契约字段名不一致，建议改 schema 而不是改前端',
      text: '契约字段名不一致，建议改 schema 而不是改前端。',
      anchor: { sessionId: 'session-lead', seq: 214, turn: 1 },
    },
    {
      id: 'approval:4',
      kind: 'approval',
      at: BASE + 420_000,
      phase: 'request',
      from: 'session-lead',
      to: 'human',
      summary: '是否允许破坏性变更？',
    },
    {
      id: 'live:5',
      kind: 'live',
      at: BASE + 720_000,
      lane: 'human',
      live: 'waiting-approval',
      waitingOn: 'session-lead',
    },
  ]
}

function detail(overrides: Partial<TicketDetailResponse> = {}): TicketDetailResponse {
  return {
    ticket: ticket(),
    mode: 'dispatch',
    origin: {
      signal: {
        kind: 'perception',
        text: '「接口契约测试报告」发生变化',
        sourceName: '配置文件',
        threadName: '变更',
        receivedAt: BASE,
      },
      decision: { action: 'dispatch', at: BASE + 59_000 },
      requestedBySessionId: 'session-router',
    },
    lanes: LANES,
    rows: rows(),
    delivery: { expectedOutput: '新契约合并后前后端测试均通过' },
    metrics: {
      agents: 3,
      hops: 1,
      supplements: 0,
      parallel: 2,
      pingPong: 0,
      turns: 5,
      tokens: 38_240,
      durationMs: 12 * 60_000,
    },
    completeness: { logs: 'full' },
    generatedAt: BASE + 13 * 60_000,
    ...overrides,
  }
}

function render(props: Partial<ComponentProps<typeof TicketDetailView>> = {}): string {
  return renderToStaticMarkup(
    <TicketDetailView
      t={t}
      detail={detail()}
      onBack={() => undefined}
      onOpenSession={() => undefined}
      {...props}
    />,
  )
}

describe('TicketDetailView', () => {
  it('heads the page with identity and one line of numbers', () => {
    const html = render()

    expect(html).toContain('工单')
    expect(html).toContain('#abcdef')
    expect(html).toContain('阻塞中')
    expect(html).toContain('修复 /v1 工单接口契约不一致')
    expect(html).toContain('负责人')
    expect(html).toContain('3 个 Agent')
    expect(html).toContain('1 次投递')
    expect(html).toContain('12 分')
    expect(html).toContain('更新于')
    expect(html).toContain('打开会话')
  })

  it('explains where the ticket came from', () => {
    const html = render()

    expect(html).toContain('感知')
    expect(html).toContain('「接口契约测试报告」发生变化')
    expect(html).toContain('路由派发工单')
  })

  it('shows the team and the chain rows', () => {
    const html = render()

    expect(html).toContain('调用链')
    expect(html).toContain('1 投递 · 2 并行')
    // chips：人 1、负责人 2、子代理 3/4。
    expect(html).toContain('pa-chip__index')
    expect(html).toContain('>1<')
    expect(html).toContain('reviewer')
    // 行：简报、并行派发、上报、审批。
    expect(html).toContain('简报投递 · [工单] #abcdef 修复契约')
    expect(html).toContain('并行派发')
    expect(html).toContain('2 个子代理')
    expect(html).toContain('上报')
    expect(html).toContain('契约字段名不一致')
    expect(html).toContain('审批')
    expect(html).toContain('等待你审批')
    // 折叠时没有展开区。
    expect(html).toContain('aria-expanded="false"')
    expect(html).not.toContain('pa-edge')
  })

  it('draws one lane guide per lane and a curve per hop', () => {
    const html = render()

    // 4 条泳道 → 每行 4 条竖线；行内还有弧线与点。
    expect(html.match(/stroke-opacity="0.2"/g)?.length).toBeGreaterThanOrEqual(16)
    expect(html).toContain('marker-end')
    expect(html).toContain('pa-rail')
  })

  it('expands a row in place with evidence and a possible impact range', () => {
    const html = render({ initialSelectedId: 'hop:3' })

    expect(html).toContain('pa-edge')
    expect(html).toContain('收到后它做了什么')
    expect(html).toContain('影响范围')
    expect(html).toContain('契约字段名不一致，建议改 schema 而不是改前端。')
    expect(html).toContain('在 reviewer 会话定位')
    expect(html).toContain('在 lead 会话定位')
    expect(html).toContain('aria-expanded="true"')
    expect(html).toContain('已选 1 条 · 影响')
  })

  it('carries the report, the criteria and four numbers', () => {
    const html = render({
      detail: detail({
        delivery: { report: '契约已合并，前后端测试通过', expectedOutput: '新契约合并后前后端测试均通过' },
      }),
    })

    expect(html).toContain('交付')
    expect(html).toContain('契约已合并，前后端测试通过')
    expect(html).toContain('对照验收标准')
    expect(html).toContain('>轮次<')
    expect(html).toContain('>38.2k<')
  })

  it('says so when nothing has been reported yet', () => {
    expect(render()).toContain('尚未汇报')
  })

  it('ends the chain with the close milestone and the outcome', () => {
    const html = render({
      detail: detail({
        ticket: ticket({ stage: 'ended', endedAt: BASE + 11 * 60_000, outcome: 'completed' }),
        rows: [
          ...rows().filter((row): row is Extract<ChainRow, { kind: 'dispatch' } | { kind: 'fan' }> => row.kind === 'dispatch' || row.kind === 'fan'),
          {
            id: 'milestone:9',
            kind: 'milestone',
            at: BASE + 11 * 60_000,
            milestone: 'closed',
          },
        ],
      }),
    })

    expect(html).toContain('已完成')
    expect(html).toContain('汇报并关闭')
    expect(html).not.toContain('等待你审批')
  })

  it('shows a queued ticket without a graph', () => {
    const html = render({
      detail: detail({
        ticket: ticket({
          stage: 'queued',
          dispatchedAt: undefined,
          workerSessionId: undefined,
          queueReason: 'capacity-full',
        }),
        lanes: [],
        rows: [{ id: 'milestone:1', kind: 'milestone', at: BASE + 1, milestone: 'queue-capacity' }],
        delivery: {},
        metrics: {
          agents: 0,
          hops: 0,
          supplements: 0,
          parallel: 0,
          pingPong: 0,
          turns: 0,
          tokens: 0,
          durationMs: 1_000,
        },
      }),
    })

    expect(html).toContain('待处理')
    expect(html).toContain('执行名额已满')
  })

  it('warns when the session logs could not be read', () => {
    expect(render({ detail: detail({ completeness: { logs: 'unavailable' } }) })).toContain(
      '会话日志不可读',
    )
  })

  it('marks an appended ticket in the origin line', () => {
    const html = render({
      detail: detail({
        mode: 'append',
        origin: { signal: { kind: 'user-message', text: '在 README 里补一段', receivedAt: BASE }, decision: { action: 'append', at: BASE + 1 } },
      }),
    })

    expect(html).toContain('路由追加工单')
  })

  it('folds the sessions and the working directory', () => {
    const html = render()

    expect(html).toContain('会话与目录')
    expect(html).toContain('3 个会话 · work/t-abcdef1234')
  })
})
