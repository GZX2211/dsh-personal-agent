// tests/host/tools/pa_ledger_query.test.ts
//
// 只读查询：范围、过滤、上限与紧凑文本；不写账本、不触发调度。

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { EventStore } from '../../../src/host/store/event-store.ts'
import {
  createLedgerQueryTool,
  parseLedgerQueryArgs,
} from '../../../src/host/tools/pa_ledger_query/index.ts'

const TICKET_A = 't-aaa1112223'
const TICKET_B = 't-bbb2223334'

let directory: string
let store: EventStore

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'pa-query-'))
  store = await EventStore.open({ directory })
})

afterEach(async () => {
  store.close()
  await rm(directory, { recursive: true, force: true })
})

function seedTicket(ticketId: string, options: { closed?: boolean } = {}): void {
  store.append({
    type: 'task/queued',
    actor: 'router',
    correlationId: ticketId,
    payload: {
      ticketId,
      title: `任务 ${ticketId.slice(-4)}`,
      goal: '把事做完',
      mode: 'dispatch',
      ...(options.closed === true ? {} : { queueReason: 'capacity-full' }),
    },
  })
  if (options.closed === true) {
    store.append({
      type: 'task/dispatched',
      actor: 'system',
      correlationId: ticketId,
      payload: { ticketId, workerSessionId: `session-${ticketId}`, mode: 'dispatch' },
    })
    store.append({
      type: 'task/closed',
      actor: 'system',
      correlationId: ticketId,
      payload: { ticketId, outcome: 'completed' },
    })
  }
}

function seedApproval(approvalId: string, ticketId: string, decided: boolean, question = '发布到生产会立刻影响用户。'): void {
  store.append({
    type: 'approval/pending',
    actor: 'worker',
    correlationId: ticketId,
    payload: {
      approvalId,
      ticketId,
      question,
      options: [{ label: '发布', description: '上线' }],
      requestedBySessionId: `session-${ticketId}`,
    },
  })
  if (decided) {
    store.append({
      type: 'approval/decided',
      actor: 'human',
      correlationId: ticketId,
      payload: {
        approvalId,
        decision: { kind: 'selected', index: 0, label: '发布' },
        decidedAt: 1_700_000_000_000,
        transport: 'inline',
      },
    })
  }
}

describe('parseLedgerQueryArgs', () => {
  it('defaults the limit to 10 and clamps it to 1..50', () => {
    expect(parseLedgerQueryArgs({ scope: 'tickets', filter: 'all' })).toEqual({
      scope: 'tickets',
      filter: 'all',
      limit: 10,
    })
    expect(parseLedgerQueryArgs({ scope: 'tickets', filter: 'all', limit: 0 }).limit).toBe(1)
    expect(parseLedgerQueryArgs({ scope: 'tickets', filter: 'all', limit: 500 }).limit).toBe(50)
  })

  it('rejects unknown scope or filter', () => {
    expect(() => parseLedgerQueryArgs({ scope: 'events', filter: 'all' })).toThrow(/scope/)
    expect(() => parseLedgerQueryArgs({ scope: 'tickets', filter: 'recent' })).toThrow(/filter/)
  })
})

describe('pa_ledger_query', () => {
  it('summarises active tickets with stage and queue reason', async () => {
    seedTicket(TICKET_A)
    const tool = createLedgerQueryTool({ store })

    const result = (await tool.execute({ scope: 'tickets', filter: 'active' }, {} as never)) as {
      text: string
    }

    expect(result.text).toContain('工单（1）')
    expect(result.text).toContain('#aaa111')
    expect(result.text).toContain('待处理')
    expect(result.text).toContain('排队：名额已满')
    expect(result.text).toContain('目标：把事做完')
  })

  it('filters ended tickets and reports their outcome context', async () => {
    seedTicket(TICKET_A)
    seedTicket(TICKET_B, { closed: true })
    const tool = createLedgerQueryTool({ store })

    const active = (await tool.execute({ scope: 'tickets', filter: 'active' }, {} as never)) as { text: string }
    const ended = (await tool.execute({ scope: 'tickets', filter: 'ended' }, {} as never)) as { text: string }

    expect(active.text).toContain('#aaa111')
    expect(active.text).not.toContain('#bbb222')
    expect(ended.text).toContain('#bbb222')
    expect(ended.text).not.toContain('#aaa111')
  })

  it('previews the first line of a long question', async () => {
    seedTicket(TICKET_A, { closed: true })
    seedApproval('a-long', TICKET_A, false, `${'很长的题干'.repeat(8)}\n第二行不该出现`)
    const tool = createLedgerQueryTool({ store })

    const result = (await tool.execute({ scope: 'approvals', filter: 'active' }, {} as never)) as {
      text: string
    }

    expect(result.text).toContain('很长的题干')
    expect(result.text).toContain('…')
    expect(result.text).not.toContain('第二行')
  })

  it('reports pending and decided approvals separately', async () => {
    seedTicket(TICKET_A, { closed: true })
    seedApproval('a-open', TICKET_A, false)
    seedApproval('a-done', TICKET_A, true)
    const tool = createLedgerQueryTool({ store })

    const pending = (await tool.execute({ scope: 'approvals', filter: 'active' }, {} as never)) as { text: string }
    const decided = (await tool.execute({ scope: 'approvals', filter: 'ended' }, {} as never)) as { text: string }

    expect(pending.text).toContain('待审批')
    expect(pending.text).toContain('#a-open')
    expect(pending.text).not.toContain('#a-done')
    expect(decided.text).toContain('已通过（发布）')
    expect(decided.text).toContain('#a-done')
  })

  it('labels an approval that is not bound to a ticket', async () => {
    store.append({
      type: 'approval/pending',
      actor: 'worker',
      correlationId: 'a-standalone',
      payload: {
        approvalId: 'a-standalone',
        question: '要不要继续？',
        options: [{ label: '继续', description: '往下做' }],
        requestedBySessionId: 'session-standalone',
      },
    })
    const tool = createLedgerQueryTool({ store })

    const result = (await tool.execute({ scope: 'approvals', filter: 'active' }, {} as never)) as {
      text: string
    }

    expect(result.text).toContain('#a-standalone')
    expect(result.text).toContain('独立审批')
    expect(result.text).not.toContain('工单 #undefined')
  })

  it('queries both scopes and marks truncated results', async () => {    seedTicket(TICKET_A)
    seedTicket(TICKET_B)
    const tool = createLedgerQueryTool({ store })

    const result = (await tool.execute({ scope: 'both', filter: 'active', limit: 1 }, {} as never)) as {
      text: string
    }

    expect(result.text).toContain('工单（2）')
    expect(result.text).toContain('另有 1 单未显示')
    expect(result.text).toContain('审批（0）')
  })

  it('writes nothing to the ledger', async () => {
    seedTicket(TICKET_A)
    const before = store.events().length
    const tool = createLedgerQueryTool({ store })

    await tool.execute({ scope: 'both', filter: 'all' }, {} as never)

    expect(store.events()).toHaveLength(before)
  })
})
