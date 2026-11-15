// tests/host/approvals/service.test.ts
//
// 决定的三支路与「先送达后记账」：inline 要等工具确认；followup 要真的投递；
// 已归档直接作废；任何失败都不写 decided。

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ResolverRegistry } from '../../../src/host/approvals/resolvers.ts'
import { createApprovalDecider, parseDecisionRequest } from '../../../src/host/approvals/service.ts'
import { EventStore } from '../../../src/host/store/event-store.ts'
import { createFakeHost, type FakeHost } from '../../support/fake-host.ts'

const TICKET_ID = 't-abcdef1234'
const WORKER_SESSION = 'session-1'

let directory: string
let store: EventStore
let host: FakeHost
let resolvers: ResolverRegistry
let decider: ReturnType<typeof createApprovalDecider>

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'pa-decide-'))
  store = await EventStore.open({ directory })
  host = createFakeHost({ liveSessionIds: [WORKER_SESSION] })
  resolvers = new ResolverRegistry()
  decider = createApprovalDecider({ ctx: host.ctx, store, resolvers, now: () => 1_700_000_000_000 })
})

afterEach(async () => {
  store.close()
  await rm(directory, { recursive: true, force: true })
})

function seedApproval(options: { approvalId?: string; requestedBySessionId?: string } = {}): void {
  const approvalId = options.approvalId ?? 'a-1'
  store.append({
    type: 'task/queued',
    actor: 'router',
    correlationId: TICKET_ID,
    payload: { ticketId: TICKET_ID, title: '发布新版本', goal: '把 v2 发布到生产', mode: 'dispatch' },
  })
  store.append({
    type: 'task/dispatched',
    actor: 'system',
    correlationId: TICKET_ID,
    payload: { ticketId: TICKET_ID, workerSessionId: WORKER_SESSION, mode: 'dispatch' },
  })
  store.append({
    type: 'approval/pending',
    actor: 'worker',
    correlationId: TICKET_ID,
    payload: {
      approvalId,
      ticketId: TICKET_ID,
      question: '发布到生产会立刻影响用户。',
      options: [
        { label: '发布', description: '立刻上线' },
        { label: '等等', description: '继续观察' },
      ],
      requestedBySessionId: options.requestedBySessionId ?? WORKER_SESSION,
    },
  })
}

function decidedEvents() {
  return store.events().filter(event => event.type === 'approval/decided')
}

describe('parseDecisionRequest', () => {
  it('rejects an out-of-range option index', () => {
    seedApproval()
    const approval = store.projection().approvals[0]
    if (approval === undefined) throw new Error('approval missing')

    expect(() => parseDecisionRequest(approval, { kind: 'selected', index: 9 })).toThrow(/下标无效/)
    expect(() => parseDecisionRequest(approval, { kind: 'selected' })).toThrow(/下标无效/)
    expect(() => parseDecisionRequest(approval, { kind: 'other' })).toThrow(/kind/)
  })

  it('rejects a non-string note', () => {
    seedApproval()
    const approval = store.projection().approvals[0]
    if (approval === undefined) throw new Error('approval missing')

    expect(() => parseDecisionRequest(approval, { kind: 'selected', index: 0, note: 3 })).toThrow(/note/)
  })

  it('ignores decision keys the current contract no longer defines', () => {
    seedApproval()
    const approval = store.projection().approvals[0]
    if (approval === undefined) throw new Error('approval missing')

    // 旧版客户端可能仍提交 fields：不得因此拒绝一个合法决定，也不得把它带进账本。
    const decision = parseDecisionRequest(approval, {
      kind: 'selected',
      index: 0,
      fields: { window: '今晚' },
    })

    expect(decision).toEqual({ kind: 'selected', index: 0, label: '发布' })
  })
})

describe('approval decider', () => {
  it('delivers inline, waits for the tool acknowledgement, then records the decision', async () => {
    seedApproval()
    const resolver = resolvers.create('a-1')

    const pending = decider.decide('a-1', { kind: 'selected', index: 0, note: '现在就发' })
    const delivery = await resolver.decision
    expect(decidedEvents()).toEqual([])
    resolver.acknowledge()
    const outcome = await pending

    expect(delivery.decision).toMatchObject({ kind: 'selected', index: 0, label: '发布' })
    expect(outcome).toEqual({ status: 200, body: { ok: true, transport: 'inline' } })
    expect(decidedEvents()).toEqual([
      expect.objectContaining({
        payload: expect.objectContaining({ transport: 'inline', decidedAt: 1_700_000_000_000 }),
      }),
    ])
  })

  it('falls back to followup when no tool is blocked', async () => {
    seedApproval()

    const outcome = await decider.decide('a-1', {
      kind: 'selected',
      index: 1,
      note: '先观察',
    })

    expect(outcome).toEqual({ status: 200, body: { ok: true, transport: 'followup' } })
    const delivered = host.sessions.get(WORKER_SESSION)?.delivered[0]
    expect(delivered?.requestId).toBe('pa-delivery:pa-approval-delivery:a-1')
    expect(delivered?.text).toContain('决定：等等（option 1）')
    expect(delivered?.text).toContain('补充说明：先观察')
    expect(decidedEvents()[0]?.payload).toMatchObject({ transport: 'followup' })
  })

  it('discards the approval when the worker session is archived', async () => {
    seedApproval()
    host.archivedSessionIds.push(WORKER_SESSION)

    const outcome = await decider.decide('a-1', { kind: 'skipped' })

    expect(outcome.status).toBe(409)
    expect(outcome.body).toEqual({
      ok: false,
      code: 'worker-archived',
      message: expect.stringContaining('已作废'),
    })
    expect(store.events().find(event => event.type === 'approval/discarded')?.payload).toMatchObject({
      approvalId: 'a-1',
      reason: 'worker-archived',
    })
    expect(store.projection().approvals).toEqual([])
    expect(host.sessions.get(WORKER_SESSION)?.delivered).toEqual([])
  })

  it('returns not-found for an unknown approval', async () => {
    seedApproval()

    const outcome = await decider.decide('a-ghost', { kind: 'skipped' })

    expect(outcome.status).toBe(404)
    expect(outcome.body).toMatchObject({ ok: false, code: 'not-found' })
  })

  it('returns already-decided for a second click', async () => {
    seedApproval()
    await decider.decide('a-1', { kind: 'skipped' })

    const outcome = await decider.decide('a-1', { kind: 'skipped' })

    expect(outcome.status).toBe(409)
    expect(outcome.body).toMatchObject({ ok: false, code: 'already-decided' })
    expect(decidedEvents()).toHaveLength(1)
  })

  it('returns invalid-decision without writing anything', async () => {
    seedApproval()

    const outcome = await decider.decide('a-1', { kind: 'selected', index: 9 })

    expect(outcome.status).toBe(400)
    expect(outcome.body).toMatchObject({ ok: false, code: 'invalid-decision' })
    expect(decidedEvents()).toEqual([])
    expect(host.sessions.get(WORKER_SESSION)?.delivered).toEqual([])
  })

  it('reports delivery-failed without writing decided when the worker is gone', async () => {
    seedApproval({ requestedBySessionId: 'session-missing' })

    const outcome = await decider.decide('a-1', { kind: 'skipped' })

    expect(outcome.status).toBe(502)
    expect(outcome.body).toMatchObject({ ok: false, code: 'delivery-failed' })
    expect(decidedEvents()).toEqual([])
    expect(store.projection().approvals).toEqual([expect.objectContaining({ id: 'a-1' })])
  })
})
