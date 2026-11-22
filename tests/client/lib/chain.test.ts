// tests/client/lib/chain.test.ts
//
// 详情页的纯逻辑：布局与缩写、时间简写、类型映射、交接计数、下游高亮与 Live 过滤。
// 这些判断不依赖 DOM，因此可以在 Node 下完整覆盖宽度边界与规模降级。

import { describe, expect, it } from 'vitest'
import type {
  AgentLaneView,
  ChainRow,
  FanRow,
  HopRow,
  LiveAgentView,
  LiveRow,
  MilestoneRow,
} from '../../../src/shared/ticket-detail.ts'
import { translateFor } from '../../../src/client/i18n.ts'
import {
  MORE_LANE_ID,
  compactName,
  computeLaneLayout,
  downstreamIdsOf,
  formatClockTime,
  formatFullTime,
  fullLaneWidth,
  ensureCoreLanes,
  handoffCount,
  laneColor,
  laneName,
  laneRoleLabel,
  liveItems,
  rowHeight,
  rowIsHandoff,
  rowKindClass,
  rowTypeKey,
  rowVisible,
  selectVisibleLanes,
  visibleFanTargets,
} from '../../../src/client/lib/chain.ts'

const t = translateFor('zh')
const NOW = new Date(2026, 10, 22, 9, 30).getTime()

function lane(
  id: string,
  index: number,
  role: AgentLaneView['role'],
  extra: Partial<AgentLaneView> = {},
): AgentLaneView {
  return { id, index, role, status: 'idle', ...extra }
}

const ROUTER = lane('router', 0, 'router')
const HUMAN = lane('human', 1, 'human')
const WORKER = lane('session-worker', 2, 'lead', { name: 'lead', sessionId: 'session-worker' })
const REVIEWER = lane('session-reviewer', 3, 'subagent', {
  name: 'reviewer',
  sessionId: 'session-reviewer',
  parentId: 'session-worker',
})

function hop(overrides: Partial<HopRow> = {}): HopRow {
  return {
    id: 'hop-1',
    at: NOW,
    kind: 'hop',
    from: WORKER.id,
    to: REVIEWER.id,
    direction: 'down',
    summary: '复核契约',
    ...overrides,
  }
}

function milestone(overrides: Partial<MilestoneRow> = {}): MilestoneRow {
  return { id: 'ms-1', at: NOW, kind: 'milestone', milestone: 'closed', ...overrides }
}

function live(overrides: Partial<LiveRow> = {}): LiveRow {
  return { id: 'live-1', at: NOW, kind: 'live', live: 'running', ...overrides }
}

describe('compactName', () => {
  it('takes two code points, not two UTF-16 units', () => {
    expect(compactName('reviewer')).toBe('re')
    expect(compactName('测试代理')).toBe('测试')
    expect(compactName('😀abc')).toBe('😀a')
  })

  it('keeps a single character name', () => {
    expect(compactName('你')).toBe('你')
    expect(compactName('')).toBe('')
  })
})

describe('fullLaneWidth', () => {
  it('stays between 44 and 60 and grows with the number of lanes', () => {
    expect(fullLaneWidth([ROUTER, HUMAN, WORKER])).toBe(44)
    expect(fullLaneWidth([ROUTER, HUMAN, WORKER, REVIEWER])).toBe(52)
    expect(fullLaneWidth([ROUTER, HUMAN, WORKER, REVIEWER, lane('a', 4, 'subagent'), lane('b', 5, 'subagent')])).toBe(60)
  })
})

describe('selectVisibleLanes', () => {
  const subs = Array.from({ length: 6 }, (_, index) =>
    lane(`session-${index}`, index + 3, 'subagent', { name: `sub-${index}`, sessionId: `session-${index}` }),
  )

  it('shows at most four subagents and reports the hidden count', () => {
    const selected = selectVisibleLanes([ROUTER, HUMAN, WORKER, ...subs], [], [], false)

    expect(selected.lanes).toHaveLength(7)
    expect(selected.hiddenCount).toBe(2)
    expect(selected.lanes.slice(3).map(item => item.id)).toEqual(['session-0', 'session-1', 'session-2', 'session-3'])
  })

  it('prioritizes subagents that are running or already in the chain', () => {
    const busy = { ...subs[5]!, status: 'running' as const }
    const selected = selectVisibleLanes([ROUTER, HUMAN, WORKER, ...subs.slice(0, 5), busy], [], [], false)

    expect(selected.lanes.slice(3).map(item => item.id)).toContain('session-5')
    expect(selected.hiddenCount).toBe(2)
  })

  it('shows every subagent once the more lane is expanded', () => {
    const selected = selectVisibleLanes([ROUTER, HUMAN, WORKER, ...subs], [], [], true)

    expect(selected.lanes).toHaveLength(9)
    expect(selected.hiddenCount).toBe(0)
  })
})

describe('computeLaneLayout', () => {
  it('keeps full names when three main lanes and the more lane fit in 540px', () => {
    const layout = computeLaneLayout({
      lanes: [ROUTER, HUMAN, WORKER],
      rows: [],
      cardWidth: 540,
      expanded: false,
    })

    expect(layout.compact).toBe(false)
    expect(layout.overflow).toBe(false)
    expect(layout.laneWidth).toBe(44)
    expect(layout.railWidth).toBe(132)
    expect(layout.hiddenCount).toBe(0)
  })

  it('compacts labels when the full lane width cannot fit', () => {
    const subs = Array.from({ length: 5 }, (_, index) =>
      lane(`session-${index}`, index + 3, 'subagent', { name: `sub-${index}`, sessionId: `session-${index}` }),
    )
    const layout = computeLaneLayout({
      lanes: [ROUTER, HUMAN, WORKER, ...subs],
      rows: [],
      cardWidth: 540,
      expanded: false,
    })

    // 三主轨 + 四个子代理 + 一个 +N：全名放不下，缩窄列宽 32。
    expect(layout.hiddenCount).toBe(1)
    expect(layout.compact).toBe(true)
    expect(layout.laneWidth).toBe(32)
    expect(layout.railWidth).toBe(268)
    expect(layout.overflow).toBe(false)
  })

  it('allows horizontal scrolling only after the compact layout still overflows', () => {
    const layout = computeLaneLayout({
      lanes: [ROUTER, HUMAN, WORKER, REVIEWER],
      rows: [],
      cardWidth: 200,
      expanded: true,
    })

    expect(layout.compact).toBe(true)
    expect(layout.overflow).toBe(true)
  })
})

describe('formatClockTime / formatFullTime', () => {
  it('keeps the narrow column to the clock time', () => {
    expect(formatClockTime(new Date(2026, 10, 15, 19, 29).getTime())).toBe('19:29')
    expect(formatClockTime(new Date(2025, 11, 31, 9, 18).getTime())).toBe('09:18')
  })

  it('gives a full local timestamp with seconds for the tooltip', () => {
    expect(formatFullTime('zh', new Date(2026, 10, 22, 9, 18, 22).getTime())).toBe('2026-11-22 09:18:22')
  })
})

describe('row type mapping', () => {
  it('maps dispatch mode and hop direction to the approved labels', () => {
    expect(rowTypeKey({ id: 'd', at: NOW, kind: 'dispatch', from: 'router', to: WORKER.id, mode: 'dispatch', summary: '' })).toBe('ticketTypeDispatch')
    expect(rowTypeKey({ id: 'd', at: NOW, kind: 'dispatch', from: 'router', to: WORKER.id, mode: 'append', summary: '' })).toBe('ticketTypeAppend')
    expect(rowTypeKey(hop({ direction: 'down' }))).toBe('ticketTypeSpawn')
    expect(rowTypeKey(hop({ direction: 'up' }))).toBe('ticketTypeUp')
    expect(rowTypeKey(hop({ direction: 'lateral' }))).toBe('ticketTypeSync')
  })

  it('maps approval phases and milestones', () => {
    expect(rowTypeKey({ id: 'a', at: NOW, kind: 'approval', phase: 'request', from: WORKER.id, to: 'human', summary: '' })).toBe('ticketTypeApproval')
    expect(rowTypeKey({ id: 'a', at: NOW, kind: 'approval', phase: 'decision', from: 'human', to: WORKER.id, summary: '' })).toBe('ticketTypeDecision')
    expect(rowTypeKey(milestone({ milestone: 'queued' }))).toBe('ticketTypeQueued')
    expect(rowTypeKey(milestone({ milestone: 'interrupted' }))).toBe('ticketTypeInterrupted')
    expect(rowTypeKey(milestone({ milestone: 'resumed' }))).toBe('ticketTypeResumed')
    expect(rowTypeKey(milestone({ milestone: 'closed' }))).toBe('ticketTypeClosed')
    expect(rowTypeKey(milestone({ milestone: 'failed' }))).toBe('ticketTypeFailed')
  })

  it('gives the failure milestone its own colour class', () => {
    expect(rowKindClass(milestone({ milestone: 'failed' }))).toBe('pa-kind-fail')
    expect(rowKindClass(milestone({ milestone: 'closed' }))).toBe('pa-kind-state')
  })

  it('uses the fan height and excludes milestones from handoffs', () => {
    const fan: FanRow = { id: 'f', at: NOW, kind: 'fan', from: WORKER.id, to: [{ sessionId: REVIEWER.id, summary: 'x' }] }
    expect(rowHeight(fan)).toBe(46)
    expect(rowHeight(milestone())).toBe(26)
    expect(rowHeight(live())).toBe(30)
    expect(rowHeight(hop())).toBe(32)
    expect(rowIsHandoff(fan)).toBe(true)
    expect(rowIsHandoff(milestone())).toBe(false)
  })
})

describe('handoffCount', () => {
  it('counts every handoff row and counts a fan once', () => {
    const rows: ChainRow[] = [
      { id: 'd', at: NOW, kind: 'dispatch', from: 'router', to: WORKER.id, mode: 'dispatch', summary: '' },
      { id: 's', at: NOW, kind: 'supplement', from: 'router', to: WORKER.id, summary: '', text: '' },
      { id: 'p', at: NOW, kind: 'spawn', from: WORKER.id, to: REVIEWER.id, summary: '' },
      { id: 'h', at: NOW, kind: 'hop', from: WORKER.id, to: REVIEWER.id, direction: 'down', summary: '' },
      {
        id: 'f',
        at: NOW,
        kind: 'fan',
        from: WORKER.id,
        to: [
          { sessionId: REVIEWER.id, summary: '' },
          { sessionId: 'session-b', summary: '' },
        ],
      },
      { id: 'a1', at: NOW, kind: 'approval', phase: 'request', from: WORKER.id, to: 'human', summary: '' },
      { id: 'a2', at: NOW, kind: 'approval', phase: 'decision', from: 'human', to: WORKER.id, summary: '' },
      { id: 'i', at: NOW, kind: 'intervene', from: 'human', to: WORKER.id, summary: '', text: '', anchor: { sessionId: WORKER.id } },
      milestone(),
      live(),
    ]

    expect(handoffCount(rows)).toBe(8)
  })
})

describe('downstreamIdsOf', () => {
  it('highlights the recipient immediate next actions and stops at another sender', () => {
    const rows: ChainRow[] = [
      hop({ id: 'first', from: WORKER.id, to: REVIEWER.id }),
      hop({ id: 'next-1', from: REVIEWER.id, to: 'session-a' }),
      milestone({ id: 'close', milestone: 'closed' }),
      hop({ id: 'next-2', from: REVIEWER.id, to: WORKER.id }),
      hop({ id: 'other', from: WORKER.id, to: REVIEWER.id }),
    ]

    expect(downstreamIdsOf(rows, 'first')).toEqual(['next-1', 'next-2'])
  })

  it('uses every fan target as a recipient', () => {
    const rows: ChainRow[] = [
      {
        id: 'fan',
        at: NOW,
        kind: 'fan',
        from: WORKER.id,
        to: [
          { sessionId: REVIEWER.id, summary: '' },
          { sessionId: 'session-b', summary: '' },
        ],
      },
      hop({ id: 'from-reviewer', from: REVIEWER.id, to: WORKER.id }),
      hop({ id: 'from-b', from: 'session-b', to: WORKER.id }),
    ]

    expect(downstreamIdsOf(rows, 'fan')).toEqual(['from-reviewer', 'from-b'])
  })

  it('does not highlight from a milestone or live row', () => {
    expect(downstreamIdsOf([milestone()], 'ms-1')).toEqual([])
    expect(downstreamIdsOf([live()], 'live-1')).toEqual([])
  })
})

describe('rowVisible', () => {
  const visible = new Set([ROUTER.id, HUMAN.id, WORKER.id, REVIEWER.id])

  it('requires both ends of a handoff to be visible', () => {
    expect(rowVisible(hop(), visible)).toBe(true)
    expect(rowVisible(hop({ to: 'hidden-sub' }), visible)).toBe(false)
  })

  it('shows a fan when at least one target is visible and filters the rest', () => {
    const fan: FanRow = {
      id: 'f',
      at: NOW,
      kind: 'fan',
      from: WORKER.id,
      to: [
        { sessionId: REVIEWER.id, summary: 'a' },
        { sessionId: 'hidden-sub', summary: 'b' },
      ],
    }

    expect(rowVisible(fan, visible)).toBe(true)
    expect(visibleFanTargets(fan, visible)).toEqual([{ sessionId: REVIEWER.id, summary: 'a' }])
  })
})

describe('liveItems', () => {
  const lanes = [ROUTER, HUMAN, WORKER, REVIEWER]
  const agents: LiveAgentView[] = [
    { lane: WORKER.id, activity: '写接口', turn: 2 },
    { lane: REVIEWER.id, turn: 1 },
  ]

  it('uses activity text and falls back to the turn', () => {
    expect(liveItems(t, live({ liveAgents: agents }), lanes)).toEqual([
      { lane: WORKER.id, text: '等待中 · lead 写接口' },
      { lane: REVIEWER.id, text: '等待中 · reviewer 第 1 轮' },
    ])
  })

  it('only includes agents on visible lanes', () => {
    expect(liveItems(t, live({ liveAgents: agents }), lanes, new Set([WORKER.id]))).toEqual([
      { lane: WORKER.id, text: '等待中 · lead 写接口' },
    ])
  })

  it('uses the worker name for the waiting-agent state', () => {
    expect(liveItems(t, live({ live: 'waiting-agent', lane: WORKER.id }), lanes)).toEqual([
      { lane: WORKER.id, text: '等待中 · lead' },
    ])
  })
})

describe('ensureCoreLanes', () => {
  it('adds Router and User in front of an old Host response', () => {
    const lanes = ensureCoreLanes(
      [
        { id: 'human', index: 0, role: 'human', status: 'idle' },
        { id: WORKER.id, index: 1, role: 'lead', status: 'running', name: 'lead', sessionId: WORKER.id },
        REVIEWER,
      ],
      WORKER.id,
    )

    expect(lanes.map(lane => [lane.id, lane.index, lane.role])).toEqual([
      ['router', 0, 'router'],
      ['human', 1, 'human'],
      [WORKER.id, 2, 'lead'],
      [REVIEWER.id, 3, 'subagent'],
    ])
  })

  it('fills all three core lanes for an empty response', () => {
    expect(ensureCoreLanes([], undefined).map(lane => lane.id)).toEqual(['router', 'human', 'worker'])
  })
})

describe('lane labels', () => {
  it('assigns identity colours by lane index', () => {
    expect(laneColor(ROUTER.id, [ROUTER, HUMAN, WORKER, REVIEWER])).toBe('#8b7bff')
    expect(laneColor(WORKER.id, [ROUTER, HUMAN, WORKER, REVIEWER])).toBe('#5b8cff')
    expect(laneColor(REVIEWER.id, [ROUTER, HUMAN, WORKER, REVIEWER])).toBe('#3fb9a1')
    expect(laneColor('missing', [ROUTER])).toBe('#8a93a6')
  })

  it('names the permanent lanes and the unbound worker', () => {
    expect(laneName(ROUTER, t)).toBe('Router')
    expect(laneName(HUMAN, t)).toBe('你')
    expect(laneName(WORKER, t)).toBe('lead')
    expect(laneName(lane('worker', 2, 'lead'), t)).toBe('Worker')
    expect(laneRoleLabel(lane('worker', 2, 'lead'), t)).toBe('待放行')
    expect(laneRoleLabel(REVIEWER, t)).toBe('子代理')
  })

  it('exposes the more lane id', () => {
    expect(MORE_LANE_ID).toBe('__more__')
  })
})
