// tests/client/lib/chain.test.ts
//
// 调用链的纯展示逻辑：泳道身份与几何、行文案与徽标、时间与时长、事实与影响范围。
// 几何断言直接把 mockup 的坐标钉死：rail 96px，lane x = 12 + 16i。

import { describe, expect, it } from 'vitest'
import type { AgentLaneView, ChainRow } from '../../../src/shared/ticket-detail.ts'
import type { TicketView } from '../../../src/shared/tickets.ts'
import { translateFor } from '../../../src/client/i18n.ts'
import {
  chainBadge,
  chainRowLink,
  chainRowSummary,
  factsAfter,
  formatClock,
  formatClockRange,
  formatDuration,
  formatTokens,
  impactRows,
  laneColorHex,
  laneDisplayName,
  laneIndexLabel,
  laneState,
  laneX,
  liveText,
  milestoneText,
  RAIL_WIDTH,
  ROUTER_X,
  rowHeight,
  shortDirectory,
} from '../../../src/client/lib/chain.ts'

const t = translateFor('zh')
const BASE = new Date(2026, 10, 21, 9, 0).getTime()

function row<T extends ChainRow['kind']>(kind: T, fields: Record<string, unknown> = {}): ChainRow {
  return { id: `${kind}:1`, kind, at: BASE + 60_000, ...fields } as unknown as ChainRow
}

function lane(id: string, role: AgentLaneView['role'], extra: Partial<AgentLaneView> = {}): AgentLaneView {
  return { id, index: 0, role, status: 'idle', ...extra }
}

function ticket(overrides: Partial<TicketView> = {}): TicketView {
  return {
    id: 't-abcdef1234',
    shortId: 'abcdef',
    title: '发布 v2',
    stage: 'running',
    goal: '把 v2 发出去',
    createdAt: BASE,
    updatedAt: BASE,
    ...overrides,
  }
}

describe('泳道几何', () => {
  it('keeps the rail fixed and puts lanes at 12 + 16i', () => {
    expect(RAIL_WIDTH).toBe(96)
    expect(laneX(0)).toBe(12)
    expect(laneX(4)).toBe(76)
    expect(ROUTER_X).toBe(4)
  })

  it('sizes rows like the mockup', () => {
    expect(rowHeight('milestone')).toBe(24)
    expect(rowHeight('hop')).toBe(34)
    expect(rowHeight('fan')).toBe(50)
  })
})

describe('泳道身份', () => {
  it('names the reserved identities and keeps agent names as-is', () => {
    expect(laneDisplayName(t, lane('human', 'human'))).toBe('你')
    expect(laneDisplayName(t, lane('r', 'router'))).toBe('路由')
    expect(laneDisplayName(t, lane('s1', 'lead'))).toBe('lead')
    expect(laneDisplayName(t, lane('s2', 'subagent', { name: 'reviewer' }))).toBe('reviewer')
    expect(laneDisplayName(t, lane('s3', 'subagent'))).toBe('子代理')
  })

  it('numbers lanes from one', () => {
    expect(laneIndexLabel(lane('human', 'human', { index: 0 }))).toBe('1')
    expect(laneIndexLabel(lane('s', 'lead', { index: 1 }))).toBe('2')
  })

  it('gives every identity a stable color', () => {
    expect(laneColorHex(lane('s', 'lead'))).toBe('#5B8CFF')
    expect(laneColorHex(lane('s', 'subagent', { name: 'reviewer' }))).toBe('#3FB9A1')
    expect(laneColorHex(lane('s', 'subagent', { name: 'architect' }))).toBe('#E0A24A')
    expect(laneColorHex(lane('s', 'subagent', { name: 'frontend' }))).toBe('#A98BFF')
    expect(laneColorHex(lane('human', 'human'))).toBe('#C9C9D0')
    expect(laneColorHex(lane('s', 'subagent', { name: 'whatever' }))).toBe('#8A93A6')
  })
})

describe('laneState', () => {
  it('writes the turn only while the worker is running', () => {
    const running = laneState(t, lane('s', 'lead', { status: 'running', currentTurn: 4 }), ticket(), false)
    const idle = laneState(t, lane('s', 'lead'), ticket(), false)

    expect(running).toEqual({ label: '第 4 轮', state: 'running' })
    expect(idle).toBeUndefined()
  })

  it('writes the ending once the ticket ended', () => {
    const done = laneState(t, lane('s', 'lead'), ticket({ stage: 'ended', outcome: 'completed' }), false)
    const failed = laneState(t, lane('s', 'lead'), ticket({ stage: 'ended', outcome: 'failed' }), false)

    expect(done?.label).toBe('已完成')
    expect(failed?.label).toBe('已失败')
  })

  it('marks the human as approved only after a decision', () => {
    expect(laneState(t, lane('human', 'human'), ticket(), true)).toEqual({ label: '已批准', state: 'live' })
    expect(laneState(t, lane('human', 'human'), ticket(), false)).toBeUndefined()
  })
})

describe('行文案', () => {
  it('labels the brief as a milestone instead of an edge', () => {
    expect(milestoneText(t, row('dispatch', { summary: '[工单] #abcdef 发布 v2' }))).toBe('简报投递')
    expect(chainRowLink(row('dispatch', { to: 's' }))).toEqual({ from: 'router', to: ['s'] })
  })

  it('names every milestone', () => {
    expect(milestoneText(t, row('milestone', { milestone: 'queued' }))).toBe('等待放行')
    expect(milestoneText(t, row('milestone', { milestone: 'closed' }))).toBe('汇报并关闭')
    expect(milestoneText(t, row('milestone', { milestone: 'failed', detail: 'turn-failed' }))).toBe(
      '工单失败 · turn-failed',
    )
  })

  it('badges what this row did with the information', () => {
    expect(chainBadge(t, row('spawn'))).toEqual({ label: '派发', tone: 'sp' })
    expect(chainBadge(t, row('fan'))).toEqual({ label: '并行派发', tone: 'sp' })
    expect(chainBadge(t, row('hop', { direction: 'up' }))).toEqual({ label: '上报', tone: 'up' })
    expect(chainBadge(t, row('hop', { direction: 'lateral' }))).toEqual({ label: '同步', tone: 'plain' })
    expect(chainBadge(t, row('hop', { direction: 'down' }))).toEqual({ label: '派发', tone: 'sp' })
    expect(chainBadge(t, row('supplement'))).toEqual({ label: '补充', tone: 'warn' })
    expect(chainBadge(t, row('approval', { phase: 'request' }))).toEqual({ label: '审批', tone: 'plain' })
    expect(chainBadge(t, row('approval', { phase: 'decision', decision: 'selected' }))).toEqual({
      label: '批准',
      tone: 'ok',
    })
    expect(chainBadge(t, row('milestone', { milestone: 'closed' }))).toBeUndefined()
  })

  it('shows the content line only where it exists', () => {
    expect(chainRowSummary(row('hop', { summary: '契约字段名不一致' }))).toBe('契约字段名不一致')
    expect(chainRowSummary(row('milestone', { milestone: 'closed' }))).toBeUndefined()
    expect(chainRowSummary(row('fan', { to: [] }))).toBeUndefined()
  })
})

describe('时间与数字', () => {
  it('prints clock values and ranges', () => {
    expect(formatClock(BASE)).toBe('09:00')
    expect(formatClockRange(t, BASE, BASE + 11 * 60_000)).toBe('09:00–09:11')
    expect(formatClockRange(t, BASE, BASE + 10_000)).toBe('09:00')
  })

  it('keeps short spans in seconds and folds long ones', () => {
    expect(formatDuration(t, 400)).toBe('1 秒')
    expect(formatDuration(t, 45_000)).toBe('45 秒')
    expect(formatDuration(t, 90_000)).toBe('1 分 30 秒')
    expect(formatDuration(t, 12 * 60_000)).toBe('12 分')
    expect(formatDuration(t, 2 * 3_600_000)).toBe('2 小时')
  })

  it('compresses token counts and directories', () => {
    expect(formatTokens(940)).toBe('940')
    expect(formatTokens(38_240)).toBe('38.2k')
    expect(shortDirectory('C:\\Users\\GZX\\.dsh\\state\\personal-agent\\work\\t-4c1b77')).toBe('work/t-4c1b77')
  })
})

describe('liveText', () => {
  it('says what the ticket is waiting for', () => {
    expect(liveText(t, row('live', { live: 'waiting-approval' }) as never, undefined)).toBe('等待你审批')
    expect(liveText(t, row('live', { live: 'running', turn: 2 }) as never, lane('s', 'subagent', { name: 'frontend' }))).toBe(
      '等待中 · frontend 正在第 2 轮',
    )
    expect(liveText(t, row('live', { live: 'waiting-agent' }) as never, undefined)).toBe('等待中 · 等待执行')
  })
})

describe('factsAfter', () => {
  it('lists what the receiver did next', () => {
    const hop = row('hop', { id: 'hop:1', at: BASE + 10, from: 'lead', to: 'reviewer' })
    const rows: ChainRow[] = [
      hop,
      row('hop', { id: 'hop:2', at: BASE + 20, from: 'reviewer', to: 'lead' }),
      row('spawn', { id: 'spawn:1', at: BASE + 30, from: 'reviewer', to: 'architect' }),
      row('milestone', { id: 'milestone:1', at: BASE + 40, milestone: 'closed' }),
    ]

    expect(factsAfter(rows, hop).map(item => item.id)).toEqual(['hop:2', 'spawn:1'])
  })

  it('counts an approval request as a fact of the asking session', () => {
    const hop = row('hop', { id: 'hop:1', at: BASE + 10, from: 'lead', to: 'reviewer' })
    const rows: ChainRow[] = [
      hop,
      row('approval', { id: 'a1', at: BASE + 20, phase: 'request', from: 'reviewer', to: 'human' }),
      row('approval', { id: 'a2', at: BASE + 30, phase: 'decision', from: 'human', to: 'reviewer' }),
    ]

    expect(factsAfter(rows, hop).map(item => item.id)).toEqual(['a1'])
  })

  it('ignores rows that happened before', () => {
    const hop = row('hop', { id: 'hop:2', at: BASE + 20, from: 'lead', to: 'reviewer' })
    const rows: ChainRow[] = [
      row('hop', { id: 'hop:1', at: BASE + 10, from: 'reviewer', to: 'lead' }),
      hop,
    ]

    expect(factsAfter(rows, hop)).toEqual([])
  })
})

describe('impactRows', () => {
  it('follows the chain from the receiver downstream', () => {
    const supplement = row('supplement', { id: 'supplement:1', at: BASE + 10, to: 'lead' })
    const rows: ChainRow[] = [
      supplement,
      row('hop', { id: 'hop:1', at: BASE + 20, from: 'lead', to: 'reviewer' }),
      row('hop', { id: 'hop:2', at: BASE + 30, from: 'reviewer', to: 'frontend' }),
      row('hop', { id: 'hop:3', at: BASE + 40, from: 'other', to: 'lead' }),
    ]

    expect(impactRows(rows, supplement).map(item => item.id)).toEqual(['hop:1', 'hop:2'])
  })

  it('stops after five rows', () => {
    const start = row('supplement', { id: 'supplement:1', at: BASE + 1, to: 'lead' })
    const rows: ChainRow[] = [start]
    for (let index = 1; index <= 8; index += 1) {
      rows.push(row('hop', { id: `hop:${index}`, at: BASE + index * 10, from: 'lead', to: `s-${index}` }))
    }

    expect(impactRows(rows, start)).toHaveLength(5)
  })

  it('returns nothing for a row without a receiver', () => {
    const milestone = row('milestone', { id: 'milestone:1', milestone: 'closed' })
    expect(impactRows([milestone], milestone)).toEqual([])
  })
})
