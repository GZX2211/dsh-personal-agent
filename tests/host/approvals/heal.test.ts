// tests/host/approvals/heal.test.ts
//
// 自愈只读 worker 会话日志里持久化的工具结果：找到决定就补记 decided{recovered}，
// 找不到就保持待审批——不猜、不编。

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { healPendingApprovals } from '../../../src/host/approvals/heal.ts'
import { EventStore } from '../../../src/host/store/event-store.ts'
import { createFakeHost, type FakeHost } from '../../support/fake-host.ts'

const TICKET_ID = 't-abcdef1234'
const WORKER_SESSION = 'session-1'

let directory: string
let store: EventStore
let host: FakeHost
let logs: string[]

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'pa-heal-'))
  store = await EventStore.open({ directory })
  host = createFakeHost({ liveSessionIds: [WORKER_SESSION] })
  logs = []
})

afterEach(async () => {
  store.close()
  await rm(directory, { recursive: true, force: true })
})

function seedPending(): void {
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
      approvalId: 'a-1',
      ticketId: TICKET_ID,
      title: '要发布吗',
      question: '发布到生产会立刻影响用户。',
      options: [{ label: '发布', description: '立刻上线' }],
      requestedBySessionId: WORKER_SESSION,
    },
  })
}

function seedDeliveredResult(): void {
  host.sessions.get(WORKER_SESSION)?.events.push({
    type: 'tool/result',
    seq: 9,
    time: 1,
    data: {
      turn: 1,
      step: 1,
      message: { id: 'r-1', role: 'tool', content: [], source: { kind: 'tool' }, toolCallId: 'call-1' },
      meta: {
        approvalId: 'a-1',
        decision: { kind: 'selected', index: 0, label: '发布' },
        decidedAt: 1_700_000_000_000,
      },
    },
  })
}

function runHeal(): Promise<number> {
  return healPendingApprovals({ ctx: host.ctx, store, log: message => logs.push(message) })
}

describe('healPendingApprovals', () => {
  it('recovers a decision that was delivered but never recorded', async () => {
    seedPending()
    seedDeliveredResult()

    await expect(runHeal()).resolves.toBe(1)

    expect(store.events().find(event => event.type === 'approval/decided')?.payload).toEqual({
      approvalId: 'a-1',
      decision: { kind: 'selected', index: 0, label: '发布' },
      decidedAt: 1_700_000_000_000,
      transport: 'inline',
      recovered: true,
    })
    expect(store.projection().approvals[0]?.decidedAt).toBe(1_700_000_000_000)
  })

  it('does nothing when the tool result was never delivered', async () => {
    seedPending()

    await expect(runHeal()).resolves.toBe(0)

    expect(store.events().some(event => event.type === 'approval/decided')).toBe(false)
    expect(store.projection().approvals[0]?.decidedAt).toBeUndefined()
  })

  it('does not recover from a different approval id', async () => {
    seedPending()
    host.sessions.get(WORKER_SESSION)?.events.push({
      type: 'tool/result',
      seq: 9,
      time: 1,
      data: { meta: { approvalId: 'a-other', decision: { kind: 'skipped' }, decidedAt: 1 } },
    })

    await expect(runHeal()).resolves.toBe(0)
  })

  it('does not recover from a malformed persisted decision', async () => {
    seedPending()
    host.sessions.get(WORKER_SESSION)?.events.push({
      type: 'tool/result',
      seq: 9,
      time: 1,
      data: { meta: { approvalId: 'a-1', decision: { kind: 'selected' }, decidedAt: 1 } },
    })

    await expect(runHeal()).resolves.toBe(0)
    expect(store.events().some(event => event.type === 'approval/decided')).toBe(false)
  })

  it('logs and continues when the worker session cannot be read', async () => {
    seedPending()
    store.append({
      type: 'approval/pending',
      actor: 'worker',
      correlationId: 't-missing001',
      payload: {
        approvalId: 'a-missing',
        ticketId: 't-missing001',
        title: '另一个审批',
        question: '会话已经不在了。',
        options: [{ label: '好', description: '确认' }],
        requestedBySessionId: 'session-missing',
      },
    })

    await expect(runHeal()).resolves.toBe(0)

    expect(logs.some(message => message.includes('self-heal skipped'))).toBe(true)
  })
})
