// tests/client/lib/chain.test.ts
//
// 调用链的纯展示逻辑：行文案、泳道身份、几何位置、时长、影响范围与来源事实。
// 断言落在用户能读到的语义上，不碰 SVG 与样式。

import { describe, expect, it } from 'vitest'
import type { AgentLaneView, ChainRow, LiveRow } from '../../../src/shared/ticket-detail.ts'
import { translateFor } from '../../../src/client/i18n.ts'
import {
  chainRowLabel,
  chainRowLink,
  chainRowSummary,
  chainRowTone,
  factsAfter,
  formatDuration,
  impactRows,
  laneColorHex,
  laneDisplayName,
  laneX,
  liveLabel,
  railWidth,
} from '../../../src/client/lib/chain.ts'

const t = translateFor('zh')
const BASE = 1_700_000_000_000

function row<T extends ChainRow['kind']>(kind: T, fields: Record<string, unknown> = {}): ChainRow {
  return { id: `${kind}:1`, kind, at: BASE + 1, ...fields } as unknown as ChainRow
}

function lane(id: string, role: AgentLaneView['role'], extra: Partial<AgentLaneView> = {}): AgentLaneView {
  return { id, index: 0, role, status: 'idle', ...extra }
}

describe('chainRowLabel', () => {
  it('names every kind of row', () => {
    expect(chainRowLabel(t, row('dispatch', { mode: 'dispatch' }))).toBe('派发')
    expect(chainRowLabel(t, row('dispatch', { mode: 'append' }))).toBe('追加')
    expect(chainRowLabel(t, row('supplement'))).toBe('补充')
    expect(chainRowLabel(t, row('spawn'))).toBe('派发子代理')
    expect(chainRowLabel(t, row('hop'))).toBe('投递')
    expect(chainRowLabel(t, row('fan', { to: [{ sessionId: 'a', summary: 'x' }] }))).toBe('并行派发 ×1')
    expect(chainRowLabel(t, row('approval', { phase: 'request' }))).toBe('审批请求')
    expect(chainRowLabel(t, row('approval', { phase: 'decision' }))).toBe('审批决定')
  })

  it('names every milestone', () => {
    expect(chainRowLabel(t, row('milestone', { milestone: 'queued' }))).toBe('等待放行')
    expect(chainRowLabel(t, row('milestone', { milestone: 'queue-busy' }))).toBe('等待执行会话空闲')
    expect(chainRowLabel(t, row('milestone', { milestone: 'queue-capacity' }))).toBe('执行名额已满')
    expect(chainRowLabel(t, row('milestone', { milestone: 'interrupted' }))).toBe('回合中断')
    expect(chainRowLabel(t, row('milestone', { milestone: 'resumed' }))).toBe('继续执行')
    expect(chainRowLabel(t, row('milestone', { milestone: 'approval-discarded' }))).toBe('审批作废')
    expect(chainRowLabel(t, row('milestone', { milestone: 'closed' }))).toBe('工单完成')
    expect(chainRowLabel(t, row('milestone', { milestone: 'failed' }))).toBe('工单失败')
  })
})

describe('chainRowSummary', () => {
  it('shows the content text of a delivery', () => {
    expect(chainRowSummary(row('hop', { summary: '帮我复核契约' }))).toBe('帮我复核契约')
    expect(chainRowSummary(row('supplement', { summary: '契约改了' }))).toBe('契约改了')
    expect(chainRowSummary(row('dispatch', { summary: '发布 v2' }))).toBe('发布 v2')
  })

  it('leaves milestones without a summary', () => {
    expect(chainRowSummary(row('milestone', { milestone: 'closed' }))).toBeUndefined()
    expect(chainRowSummary(row('approval', { phase: 'decision', summary: '发布', decision: 'selected' }))).toBeUndefined()
  })
})

describe('chainRowTone', () => {
  it('tones a failed end and a blocked wait differently from ordinary rows', () => {
    expect(chainRowTone(row('milestone', { milestone: 'failed' }))).toBe('danger')
    expect(chainRowTone(row('milestone', { milestone: 'interrupted' }))).toBe('warning')
    expect(chainRowTone(row('milestone', { milestone: 'closed' }))).toBe('success')
    expect(chainRowTone(row('supplement'))).toBe('info')
    expect(chainRowTone(row('hop'))).toBe('neutral')
  })
})

describe('lanes', () => {
  it('names the reserved lanes from the dictionary and keeps agent names as-is', () => {
    expect(laneDisplayName(t, lane('router', 'router'))).toBe('路由')
    expect(laneDisplayName(t, lane('human', 'human'))).toBe('你')
    expect(laneDisplayName(t, lane('session-1', 'lead'))).toBe('负责人')
    expect(laneDisplayName(t, lane('session-2', 'subagent', { name: 'reviewer' }))).toBe('reviewer')
    expect(laneDisplayName(t, lane('session-3', 'subagent'))).toBe('子代理')
  })

  it('gives every identity a stable color', () => {
    expect(laneColorHex(lane('session-1', 'lead'))).toBe('#5B8CFF')
    expect(laneColorHex(lane('session-2', 'subagent', { name: 'reviewer' }))).toBe('#3FB9A1')
    expect(laneColorHex(lane('session-2', 'subagent', { name: 'architect' }))).toBe('#E0A24A')
    expect(laneColorHex(lane('router', 'router'))).toBe('#8A93A6')
    expect(laneColorHex(lane('human', 'human'))).toBe('#C9C9D0')
    expect(laneColorHex(lane('session-9', 'subagent', { name: 'whatever' }))).toBe('#7C8698')
  })

  it('places lanes on the rail and sizes the rail from the lane count', () => {
    expect(laneX(0)).toBe(12)
    expect(laneX(2)).toBe(44)
    expect(railWidth(1)).toBe(20)
    expect(railWidth(3)).toBe(52)
  })
})

describe('chainRowLink', () => {
  it('connects the two ends of a delivery', () => {
    expect(chainRowLink(row('dispatch', { to: 'session-worker' }))).toEqual({
      from: 'router',
      to: ['session-worker'],
    })
    expect(chainRowLink(row('hop', { from: 'a', to: 'b' }))).toEqual({ from: 'a', to: ['b'] })
    expect(
      chainRowLink(row('fan', { from: 'a', to: [{ sessionId: 'b', summary: '' }, { sessionId: 'c', summary: '' }] })),
    ).toEqual({ from: 'a', to: ['b', 'c'] })
    expect(chainRowLink(row('approval', { phase: 'decision', to: 'a' }))).toEqual({
      from: 'human',
      to: ['a'],
    })
  })

  it('leaves milestones and the live row unlinked', () => {
    expect(chainRowLink(row('milestone', { milestone: 'closed' }))).toBeUndefined()
    expect(chainRowLink(row('live', { live: 'running' }))).toBeUndefined()
  })
})

describe('liveLabel', () => {
  it('says what the ticket is waiting for', () => {
    expect(liveLabel(t, row('live', { live: 'waiting-approval' }) as LiveRow)).toBe('等待你审批')
    expect(liveLabel(t, row('live', { live: 'waiting-agent' }) as LiveRow)).toBe('等待执行')
    expect(liveLabel(t, row('live', { live: 'running', turn: 3 }) as LiveRow)).toBe('正在第 3 轮')
    expect(liveLabel(t, row('live', { live: 'running' }) as LiveRow)).toBe('正在执行')
  })
})

describe('formatDuration', () => {
  it('keeps short spans in seconds and folds long ones', () => {
    expect(formatDuration(t, 400)).toBe('1 秒')
    expect(formatDuration(t, 45_000)).toBe('45 秒')
    expect(formatDuration(t, 90_000)).toBe('1 分 30 秒')
    expect(formatDuration(t, 3 * 60_000)).toBe('3 分')
    expect(formatDuration(t, 2 * 3_600_000)).toBe('2 小时')
  })
})

describe('factsAfter', () => {
  it('lists what the receiver did next, newest evidence first', () => {
    const hop = row('hop', { id: 'hop:1', at: BASE + 10, from: 'lead', to: 'reviewer', summary: '复核契约' })
    const rows: ChainRow[] = [
      hop,
      row('hop', { id: 'hop:2', at: BASE + 20, from: 'reviewer', to: 'lead', summary: '契约写错了' }),
      row('spawn', { id: 'spawn:1', at: BASE + 30, from: 'reviewer', to: 'architect', summary: '改契约' }),
      row('milestone', { id: 'milestone:1', at: BASE + 40, milestone: 'closed' }),
    ]

    expect(factsAfter(rows, hop).map(item => item.id)).toEqual(['hop:2', 'spawn:1'])
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
      // 与这条链无关的一行：它不该被算成影响范围。
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

  it('returns nothing for an ended milestone', () => {
    expect(impactRows([row('milestone', { milestone: 'closed' })], row('milestone', { milestone: 'closed' }))).toEqual([])
  })
})
