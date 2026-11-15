// tests/client/lib/filter.test.ts
//
// 搜索与胶囊：关键词按空白分词后取 AND，胶囊与关键词取交集；haystack 覆盖
// 卡片上看得见的字段与附件，空查询不过滤。

import { describe, expect, it } from 'vitest'
import type { ApprovalView } from '../../../src/shared/approvals.ts'
import type { TicketView } from '../../../src/shared/tickets.ts'
import {
  approvalHaystack,
  buildHaystack,
  filterApprovals,
  filterTickets,
  matchesQuery,
  ticketHaystack,
  tokenizeQuery,
  type FilterContext,
} from '../../../src/client/lib/filter.ts'
import { translateFor } from '../../../src/client/i18n.ts'

const NOW = 1_700_000_000_000
const ctx: FilterContext = { t: translateFor('zh'), language: 'zh-CN' }

function approval(overrides: Partial<ApprovalView> = {}): ApprovalView {
  return {
    id: 'a-684460e5f9',
    ticketId: 't-7380b609ef',
    question: '要发布到生产吗？',
    options: [
      { label: '发布', description: '立刻上线' },
      { label: '等等', description: '继续观察' },
    ],
    attachments: ['D:/pa-work/t-7380b609ef/发布说明.md'],
    requestedBySessionId: 'session-19b0e213',
    createdAt: NOW,
    ...overrides,
  }
}

function ticket(overrides: Partial<TicketView> = {}): TicketView {
  return {
    id: 't-9c20e78bca',
    shortId: '9c20e7',
    title: '建文件',
    stage: 'running',
    goal: '在 D:\\tmp 下创建 hello.txt',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

describe('tokenizeQuery', () => {
  it('splits on whitespace, lowercases and drops empties', () => {
    expect(tokenizeQuery('  发布   PROD  ')).toEqual(['发布', 'prod'])
    expect(tokenizeQuery('发布　生产')).toEqual(['发布', '生产'])
    expect(tokenizeQuery('   ')).toEqual([])
  })
})

describe('matchesQuery', () => {
  it('requires every token', () => {
    expect(matchesQuery('发布 到 生产', ['发布', '生产'])).toBe(true)
    expect(matchesQuery('发布 到 生产', ['发布', '测试'])).toBe(false)
    expect(matchesQuery('任意文本', [])).toBe(true)
  })
})

describe('buildHaystack', () => {
  it('flattens nested arrays and objects and lowercases', () => {
    expect(buildHaystack(['A', { label: 'B', list: ['C', 3] }, undefined, true])).toBe('a b c 3 true')
  })
})

describe('approvalHaystack', () => {
  it('covers the question, options, attachments and the recorded answer', () => {
    const haystack = approvalHaystack(
      approval({
        decision: { kind: 'selected', index: 0, label: '发布', note: '今晚发', transport: 'inline' },
        decidedAt: NOW + 1000,
      }),
      ctx,
    )

    expect(haystack).toContain('要发布到生产吗')
    expect(haystack).toContain('继续观察')
    expect(haystack).toContain('发布说明.md')
    expect(haystack).toContain('今晚发')
    expect(haystack).toContain('7380b6')
  })
})

describe('ticketHaystack', () => {
  it('covers the goal, the directory and the副标签 text', () => {
    const blocked = ticketHaystack(
      ticket({ stage: 'blocked', directory: 'D:\\pa-work\\t-9c20e78bca', report: '已完成' }),
      ctx,
    )
    const interrupted = ticketHaystack(ticket({ stage: 'running', interrupted: true }), ctx)

    expect(blocked).toContain('hello.txt')
    expect(blocked).toContain('pa-work')
    expect(blocked).toContain('已完成')
    expect(blocked).toContain('阻塞中')
    expect(interrupted).toContain('已中断')
  })
})

describe('filterApprovals', () => {
  it('intersects the capsule with the query and keeps ledger order', () => {
    const pending = approval({ id: 'a-1', question: '要发布吗' })
    const decided = approval({ id: 'a-2', question: '要回滚吗', decidedAt: NOW + 1 })
    const list = [pending, decided]

    expect(filterApprovals(list, 'pending', '', ctx).map(item => item.id)).toEqual(['a-1'])
    expect(filterApprovals(list, 'decided', '', ctx).map(item => item.id)).toEqual(['a-2'])
    expect(filterApprovals(list, 'all', '', ctx).map(item => item.id)).toEqual(['a-1', 'a-2'])
    expect(filterApprovals(list, 'all', '回滚', ctx).map(item => item.id)).toEqual(['a-2'])
    expect(filterApprovals(list, 'pending', '回滚', ctx)).toEqual([])
  })
})

describe('filterTickets', () => {
  it('treats blocked as running and matches the query', () => {
    const queued = ticket({ id: 't-1', stage: 'queued', title: '排队单' })
    const blocked = ticket({ id: 't-2', stage: 'blocked', title: '阻塞单' })
    const ended = ticket({ id: 't-3', stage: 'ended', title: '结束单' })
    const list = [queued, blocked, ended]

    expect(filterTickets(list, 'queued', '', ctx).map(item => item.id)).toEqual(['t-1'])
    expect(filterTickets(list, 'running', '', ctx).map(item => item.id)).toEqual(['t-2'])
    expect(filterTickets(list, 'ended', '', ctx).map(item => item.id)).toEqual(['t-3'])
    expect(filterTickets(list, 'all', '结束', ctx).map(item => item.id)).toEqual(['t-3'])
  })
})
