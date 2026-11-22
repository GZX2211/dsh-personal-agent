// tests/host/sessions/detail-service.test.ts
//
// 详情装配：账本 + 会话窗口 → 详情视图，并带一层缓存。
// 缓存键必须足够灵敏：账本一长或工单时间一变，就必须重算，不能拿旧链糊弄页面。

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { SessionEvent, SessionId } from '@deepseek-ai/dsh-session'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createTicketDetailService } from '../../../src/host/sessions/detail-service.ts'
import { EventStore } from '../../../src/host/store/event-store.ts'
import { createFakeHost, type FakeHost } from '../../support/fake-host.ts'

const ROUTER = 'session-router'
const WORKER = 'session-worker' as SessionId
const TICKET_ID = 't-abcdef1234'
const START = 1_700_000_000_000

let directory: string
let store: EventStore
let host: FakeHost
let clock: number

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'pa-detail-service-'))
  clock = START
  store = await EventStore.open({ directory, now: () => clock })
  host = createFakeHost({ liveSessionIds: [ROUTER, WORKER] })
  seedTicket()
  // 工单在 START 落账；之后时钟往前走，窗口才有余量容纳会话事件。
  clock = START + 1000
})

afterEach(async () => {
  store.close()
  await rm(directory, { recursive: true, force: true })
})

function seedTicket(): void {
  store.append({
    type: 'task/queued',
    actor: 'router',
    correlationId: TICKET_ID,
    sessionId: ROUTER,
    payload: {
      ticketId: TICKET_ID,
      title: '发布 v2',
      goal: '把 v2 发出去',
      mode: 'dispatch',
      requestedBySessionId: ROUTER,
    },
  })
  store.append({
    type: 'task/dispatched',
    actor: 'system',
    correlationId: TICKET_ID,
    payload: { ticketId: TICKET_ID, workerSessionId: WORKER, mode: 'dispatch' },
  })
}

function pushWorker(type: string, time: number, data: Record<string, unknown>): void {
  const session = host.sessions.get(WORKER)
  if (session === undefined) throw new Error('missing worker session')
  session.events.push({ seq: session.events.length + 1, time, type, data } as SessionEvent)
}

function service() {
  return createTicketDetailService({
    ctx: host.ctx,
    store,
    now: () => clock,
    log: () => undefined,
  })
}

describe('createTicketDetailService', () => {
  it('returns undefined for a ticket that does not exist', async () => {
    const detail = await service().detail('t-missing000')

    expect(detail).toBeUndefined()
  })

  it('derives the detail from the ledger and the worker log', async () => {
    pushWorker('turn/start', START + 500, { turn: 1 })

    const detail = await service().detail(TICKET_ID)

    expect(detail).toMatchObject({
      mode: 'dispatch',
      ticket: { id: TICKET_ID },
      completeness: { logs: 'full' },
    })
    expect(detail?.lanes.map(lane => lane.role)).toEqual(['router', 'human', 'lead'])
    expect(detail?.rows[0]).toMatchObject({ kind: 'dispatch', to: WORKER })
  })

  it('serves the cached detail within the running ttl', async () => {
    const details = service()
    const first = await details.detail(TICKET_ID)
    // 账本与会话都没变：缓存命中，连对象都是同一个。
    const second = await details.detail(TICKET_ID)

    expect(second).toBe(first)
  })

  it('recomputes when the ledger grows', async () => {
    const details = service()
    const first = await details.detail(TICKET_ID)

    clock = START + 20_000
    store.append({
      type: 'task/supplemented',
      actor: 'router',
      correlationId: TICKET_ID,
      sessionId: ROUTER,
      payload: {
        ticketId: TICKET_ID,
        targetSessionId: WORKER,
        text: '契约改了',
        requestedBySessionId: ROUTER,
      },
    })
    const second = await details.detail(TICKET_ID)

    expect(second).not.toBe(first)
    expect(second?.metrics.supplements).toBe(1)
  })

  it('recomputes a running ticket after its ttl expires', async () => {
    const details = service()
    const first = await details.detail(TICKET_ID)

    clock = START + 3000
    pushWorker('turn/start', START + 2500, { turn: 1 })
    const second = await details.detail(TICKET_ID)

    expect(second).not.toBe(first)
    expect(second?.lanes[2]).toMatchObject({ status: 'running', turns: 1 })
  })

  it('keeps an ended ticket cached longer than a running one', async () => {
    store.append({
      type: 'task/closed',
      actor: 'system',
      correlationId: TICKET_ID,
      payload: { ticketId: TICKET_ID, outcome: 'completed' },
    })
    const details = service()
    const first = await details.detail(TICKET_ID)

    clock = START + 30_000
    const second = await details.detail(TICKET_ID)

    expect(second).toBe(first)
  })
})
