// tests/client/lib/filter.test.ts
//
// 两页共用的搜索与胶囊过滤（方案 §10.5）：haystack 覆盖全部业务字段，
// 多关键词 AND、大小写不敏感，搜索与胶囊是交集关系。

import { describe, expect, it } from 'vitest'
import type { ApprovalView } from '../../../src/shared/approvals.ts'
import type { TicketView } from '../../../src/shared/tickets.ts'
import { translateFor } from '../../../src/client/i18n.ts'
import { formatTime } from '../../../src/client/lib/format.ts'
import {
  approvalHaystack,
  filterApprovals,
  filterTickets,
  matchesApprovalCapsule,
  matchesQuery,
  matchesTicketCapsule,
  ticketHaystack,
  tokenizeQuery,
  type FilterContext,
} from '../../../src/client/lib/filter.ts'

const NOW = 1_700_000_000_000

const CTX: FilterContext = { t: translateFor('zh'), language: 'zh', now: NOW }

function approval(overrides: Partial<ApprovalView> = {}): ApprovalView {
  return {
    id: 'a-684460e5f9',
    ticketId: 't-7380b609ef',
    title: '测试审批：验证审批链路',
    question: '发布到生产会立刻影响用户，是否继续？',
    options: [
      { label: '批准', description: '继续发布' },
      { label: '拒绝', description: '停止发布' },
    ],
    fields: [{ key: 'window', label: '发布时间窗', type: 'text' }],
    requestedBySessionId: 'session-19b0e213',
    createdAt: NOW - 3 * 60_000,
    ...overrides,
  }
}

function ticket(overrides: Partial<TicketView> = {}): TicketView {
  return {
    id: 't-9c20e78bca',
    shortId: '9c20e7',
    title: '创建 hello.txt 并写入 P2 OK',
    stage: 'blocked',
    goal: '在 D:\\tmp\\pa-smoke 下创建 hello.txt',
    context: '用户原话：建一个 hello.txt',
    constraints: ['只创建这一个文件', '不要读写账本'],
    expectedOutput: 'hello.txt 存在且内容为 P2 OK',
    workerSessionId: 'session-c3faa82c',
    directory: 'C:\\Users\\GZX\\.dsh\\state\\personal-agent\\work\\t-9c20e78bca',
    createdAt: NOW - 2 * 3_600_000,
    updatedAt: NOW - 5 * 60_000,
    ...overrides,
  }
}

describe('tokenizeQuery', () => {
  it('splits on whitespace, trims and lowercases', () => {
    expect(tokenizeQuery('  Hello   WORLD  ')).toEqual(['hello', 'world'])
    expect(tokenizeQuery('   ')).toEqual([])
    expect(tokenizeQuery('')).toEqual([])
  })
})

describe('matchesQuery', () => {
  it('requires every keyword and treats an empty query as no filter', () => {
    expect(matchesQuery('hello world', ['hello'])).toBe(true)
    expect(matchesQuery('hello world', ['hello', 'world'])).toBe(true)
    expect(matchesQuery('hello world', ['hello', 'missing'])).toBe(false)
    expect(matchesQuery('hello world', [])).toBe(true)
  })

  it('treats regex metacharacters in a query as plain text', () => {
    expect(matchesQuery('a.b*c', ['a.b'])).toBe(true)
    expect(matchesQuery('a.b*c', ['.*'])).toBe(false)
  })
})

describe('approvalHaystack', () => {
  it('covers title, question, options, fields, ids and localized time', () => {
    const haystack = approvalHaystack(approval(), CTX)

    expect(haystack).toContain('测试审批：验证审批链路')
    expect(haystack).toContain('发布到生产会立刻影响用户')
    expect(haystack).toContain('拒绝')
    expect(haystack).toContain('停止发布')
    expect(haystack).toContain('发布时间窗')
    expect(haystack).toContain('a-684460e5f9')
    expect(haystack).toContain('7380b6')
    expect(haystack).toContain('3 分钟前')
    expect(haystack).toContain('session-19b0e213')
  })

  it('covers the recorded decision of a decided approval', () => {
    const haystack = approvalHaystack(
      approval({
        decidedAt: NOW - 60_000,
        decision: {
          kind: 'selected',
          index: 0,
          label: '批准',
          note: '先灰度',
          transport: 'inline',
        },
      }),
      CTX,
    )

    expect(haystack).toContain('先灰度')
    expect(haystack).toContain('批准')
  })

  it('matches the raw timestamp and ignores absent optional fields', () => {
    const at = NOW - 1_000
    const haystack = approvalHaystack(approval({ createdAt: at, decidedAt: undefined }), CTX)

    expect(haystack).toContain(String(at))
    expect(haystack).not.toContain('decided')
  })
})

describe('ticketHaystack', () => {
  it('covers goal, context, constraints, expected output and identifiers', () => {
    const haystack = ticketHaystack(ticket(), CTX)

    // haystack 按契约小写化，查询同样小写化，所以大小写不参与匹配。
    expect(haystack).toContain('创建 hello.txt 并写入 p2 ok')
    expect(haystack).toContain('d:\\tmp\\pa-smoke')
    expect(haystack).toContain('用户原话')
    expect(haystack).toContain('只创建这一个文件')
    expect(haystack).toContain('p2 ok')
    expect(haystack).toContain('9c20e7')
    expect(haystack).toContain('session-c3faa82c')
    expect(haystack).toContain('work\\t-9c20e78bca')
    expect(haystack).toContain('2 小时前')
  })

  it('covers the report, queue reason and outcome of other stages', () => {
    const haystack = ticketHaystack(
      ticket({
        stage: 'queued',
        queueReason: 'capacity-full',
        report: undefined,
      }),
      CTX,
    )
    expect(haystack).toContain('名额已满')

    const ended = ticketHaystack(
      ticket({ stage: 'ended', endedAt: NOW, outcome: 'completed', report: '已完成并验证内容' }),
      CTX,
    )
    expect(ended).toContain('已完成并验证内容')
    expect(ended).toContain('已完成')
  })
})

describe('matchesApprovalCapsule', () => {
  it('separates pending from decided and lets all through', () => {
    expect(matchesApprovalCapsule(approval(), 'pending')).toBe(true)
    expect(matchesApprovalCapsule(approval(), 'decided')).toBe(false)
    expect(matchesApprovalCapsule(approval(), 'all')).toBe(true)

    const decided = approval({
      decidedAt: NOW,
      decision: { kind: 'skipped', transport: 'followup' },
    })
    expect(matchesApprovalCapsule(decided, 'pending')).toBe(false)
    expect(matchesApprovalCapsule(decided, 'decided')).toBe(true)
  })
})

describe('matchesTicketCapsule', () => {
  it('counts blocked as running and keeps queued and ended apart', () => {
    expect(matchesTicketCapsule(ticket(), 'running')).toBe(true)
    expect(matchesTicketCapsule(ticket({ stage: 'running' }), 'running')).toBe(true)
    expect(matchesTicketCapsule(ticket({ stage: 'queued' }), 'running')).toBe(false)
    expect(matchesTicketCapsule(ticket({ stage: 'ended' }), 'running')).toBe(false)

    expect(matchesTicketCapsule(ticket({ stage: 'queued' }), 'queued')).toBe(true)
    expect(matchesTicketCapsule(ticket({ stage: 'ended' }), 'ended')).toBe(true)
    expect(matchesTicketCapsule(ticket({ stage: 'ended' }), 'all')).toBe(true)
  })

  it('keeps an interrupted worker inside the running capsule', () => {
    expect(matchesTicketCapsule(ticket({ stage: 'running', interrupted: true }), 'running')).toBe(true)
  })
})

describe('filterApprovals / filterTickets', () => {
  it('intersects the capsule with the query and preserves order', () => {
    const approvals = [
      approval({ id: 'a-1', title: '发布 v2' }),
      approval({
        id: 'a-2',
        title: '删除缓存',
        question: '删除缓存会不会影响线上？',
        options: [{ label: '确认', description: '执行删除' }],
        fields: [],
      }),
      approval({ id: 'a-3', title: '发布 v3', decidedAt: NOW, decision: { kind: 'skipped', transport: 'followup' } }),
    ]

    const result = filterApprovals(approvals, 'pending', '发布', CTX)
    expect(result.map(item => item.id)).toEqual(['a-1'])
  })

  it('returns everything for an empty query and the all capsule', () => {
    const items = [approval({ id: 'a-1' }), approval({ id: 'a-2' })]
    expect(filterApprovals(items, 'all', '', CTX).map(item => item.id)).toEqual(['a-1', 'a-2'])
  })

  it('filters tickets by capsule and keywords together', () => {
    const items = [
      ticket({ id: 't-1', title: '建文件', stage: 'ended', outcome: 'completed' }),
      ticket({ id: 't-2', title: '建目录', stage: 'queued' }),
    ]

    expect(filterTickets(items, 'queued', '', CTX).map(item => item.id)).toEqual(['t-2'])
    expect(filterTickets(items, 'all', '建目录', CTX).map(item => item.id)).toEqual(['t-2'])
    expect(filterTickets(items, 'ended', '建文件', CTX).map(item => item.id)).toEqual(['t-1'])
  })

  it('formats the time text of a ticket with the request language', () => {
    const t = translateFor('en')
    const at = NOW - 3 * 60_000
    expect(formatTime(t, 'en', NOW, at)).toBe('3 min ago')
  })
})
