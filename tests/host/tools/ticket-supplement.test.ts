// tests/host/tools/ticket-supplement.test.ts
//
// pa_ticket_supplement 是 router 的「插话」入口：给正在执行的工单补一条信息，不建单。
// 失败码必须稳定可路由（invalid-arguments / ticket-not-found / ticket-not-running /
// session-not-live / invalid-signal / delivery-failed）。

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ToolRunContext } from '@deepseek-ai/dsh-tools'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createClaimRegistry, type ClaimRegistry } from '../../../src/host/signals/claim.ts'
import { EventStore } from '../../../src/host/store/event-store.ts'
import {
  createTicketSupplementTool,
  parseTicketSupplementArgs,
} from '../../../src/host/tools/pa_ticket_supplement/index.ts'
import { createFakeHost, type FakeHost } from '../../support/fake-host.ts'

const ROUTER = 'session-router'
const WORKER = 'session-worker'
const TICKET_ID = 't-abcdef1234'

let directory: string
let store: EventStore
let host: FakeHost
let claims: ClaimRegistry

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'pa-supplement-'))
  store = await EventStore.open({ directory })
  host = createFakeHost({ liveSessionIds: [ROUTER, WORKER] })
  host.setTurn(ROUTER, 1)
  claims = createClaimRegistry()
})

afterEach(async () => {
  store.close()
  await rm(directory, { recursive: true, force: true })
})

function queueTicket(payload: { mode?: 'dispatch' | 'append'; workerSessionId?: string } = {}): void {
  store.append({
    type: 'task/queued',
    actor: 'router',
    correlationId: TICKET_ID,
    sessionId: ROUTER,
    payload: {
      ticketId: TICKET_ID,
      title: '发布 v2',
      goal: '把 v2 发出去',
      mode: payload.mode ?? 'dispatch',
      requestedBySessionId: ROUTER,
      ...(payload.workerSessionId === undefined ? {} : { workerSessionId: payload.workerSessionId }),
    },
  })
}

function dispatchTicket(): void {
  store.append({
    type: 'task/dispatched',
    actor: 'system',
    correlationId: TICKET_ID,
    payload: { ticketId: TICKET_ID, workerSessionId: WORKER, mode: 'dispatch' },
  })
}

/** 一张正在执行的工单。 */
function runningTicket(): void {
  queueTicket()
  dispatchTicket()
}

function closeTicket(outcome: 'completed' | 'failed' = 'completed'): void {
  store.append({
    type: 'task/closed',
    actor: 'system',
    correlationId: TICKET_ID,
    payload: { ticketId: TICKET_ID, outcome },
  })
}

function requestApproval(): void {
  store.append({
    type: 'approval/pending',
    actor: 'worker',
    correlationId: 'a-1',
    sessionId: WORKER,
    payload: {
      approvalId: 'a-1',
      ticketId: TICKET_ID,
      question: '要不要发布到生产？',
      options: [{ label: '发布', description: '立刻上线' }],
      requestedBySessionId: WORKER,
    },
  })
}

function makeTool(registry: ClaimRegistry = claims): ReturnType<typeof createTicketSupplementTool> {
  return createTicketSupplementTool({ ctx: host.ctx, store, claims: registry })
}

function execution(): ToolRunContext {
  return {
    signal: new AbortController().signal,
    agent: { session: { id: ROUTER } },
    callId: 'call-1',
    rootCallId: 'call-1',
    name: 'pa_ticket_supplement',
    arguments: {},
    token: Symbol('call'),
  } as unknown as ToolRunContext
}

async function run(
  args: Record<string, unknown>,
  tool = makeTool(),
): Promise<{ ticketId: string; status: string; signalId?: string }> {
  return (await tool.execute(args, execution())) as {
    ticketId: string
    status: string
    signalId?: string
  }
}

/** 让一条信号进入某个回合，就像它刚刚被 router 取用。 */
function deliverSignal(messageId: string, signalId: string, turn = 1): void {
  claims.record(messageId, signalId)
  claims.onClaimed(messageId, turn)
}

function supplementedEvents(): { ticketId: string; text: string; messageId?: string; sessionId?: string; correlationId: string }[] {
  return store.events().flatMap(event =>
    event.type === 'task/supplemented'
      ? [
          {
            ticketId: event.payload.ticketId,
            text: event.payload.text,
            messageId: event.payload.messageId,
            sessionId: event.sessionId,
            correlationId: event.correlationId,
          },
        ]
      : [],
  )
}

function supplementDecisions(): { action: string; signalId: string; ticketId?: string }[] {
  return store.events().flatMap(event =>
    event.type === 'decision/recorded' && event.payload.action === 'supplement'
      ? [
          {
            action: event.payload.action,
            signalId: event.payload.signalId,
            ticketId: event.payload.ticketId,
          },
        ]
      : [],
  )
}

describe('parseTicketSupplementArgs', () => {
  it('trims the text and keeps the optional signal', () => {
    const parsed = parseTicketSupplementArgs({
      ticketId: ' t-abcdef1234 ',
      text: '  契约改了，按新字段实现  ',
      signalId: 's-1',
    })

    expect(parsed).toEqual({
      ticketId: TICKET_ID,
      text: '契约改了，按新字段实现',
      signalId: 's-1',
    })
  })

  it('rejects empty text and an empty ticket id', () => {
    expect(() => parseTicketSupplementArgs({ ticketId: TICKET_ID, text: '   ' })).toThrow(/text/)
    expect(() => parseTicketSupplementArgs({ ticketId: '', text: '补充' })).toThrow(/ticketId/)
  })

  it('rejects text longer than the delivery limit', () => {
    expect(() => parseTicketSupplementArgs({ ticketId: TICKET_ID, text: '很'.repeat(4001) })).toThrow(
      /4000/,
    )
  })
})

describe('pa_ticket_supplement', () => {
  it('steers a supplement into the worker of a running ticket', async () => {
    runningTicket()

    const result = await run({ ticketId: TICKET_ID, text: '契约改了，按新字段实现' })

    expect(result).toEqual({ ticketId: TICKET_ID, status: 'delivered' })
    const session = host.sessions.get(WORKER)
    expect(session?.delivered).toHaveLength(1)
    expect(session?.delivered[0]).toMatchObject({
      text: '契约改了，按新字段实现',
      steered: true,
      message: {
        source: {
          kind: 'dsh-personal-agent',
          form: 'relay',
          ticketId: TICKET_ID,
          supplementId: expect.stringContaining(`pa-supplement:${TICKET_ID}:`),
        },
      },
    })
  })

  it('records the supplement fact after delivering it', async () => {
    runningTicket()

    await run({ ticketId: TICKET_ID, text: '契约改了' })

    const delivery = host.sessions.get(WORKER)?.delivered[0]
    expect(supplementedEvents()).toEqual([
      {
        ticketId: TICKET_ID,
        text: '契约改了',
        messageId: delivery?.requestId,
        sessionId: ROUTER,
        correlationId: TICKET_ID,
      },
    ])
  })

  it('does not create a ticket of its own', async () => {
    runningTicket()
    const before = store.projection().tickets.length

    await run({ ticketId: TICKET_ID, text: '契约改了' })

    expect(store.projection().tickets).toHaveLength(before)
    expect(store.events().some(event => event.type === 'task/queued' && event.payload.ticketId !== TICKET_ID)).toBe(
      false,
    )
  })

  it('accepts a supplement for a ticket blocked on an approval', async () => {
    runningTicket()
    requestApproval()

    const result = await run({ ticketId: TICKET_ID, text: '审批还没回，先把文档补上' })

    expect(result.status).toBe('delivered')
    // 补充不解决审批：工单仍在阻塞中。
    expect(store.projection().tickets[0]?.stage).toBe('blocked')
  })

  it('claims the pending signal and records the decision', async () => {
    runningTicket()
    deliverSignal('pa-perception:1', 's-1')

    const result = await run({ ticketId: TICKET_ID, text: '契约改了' })

    expect(result.signalId).toBe('s-1')
    expect(supplementDecisions()).toEqual([
      { action: 'supplement', signalId: 's-1', ticketId: TICKET_ID },
    ])
  })

  it('claims an explicitly named signal', async () => {
    runningTicket()
    deliverSignal('pa-perception:1', 's-1')
    deliverSignal('pa-perception:2', 's-2')

    await run({ ticketId: TICKET_ID, text: '契约改了', signalId: 's-2' })

    expect(supplementDecisions()).toEqual([
      { action: 'supplement', signalId: 's-2', ticketId: TICKET_ID },
    ])
    // 显式指认只取那一条，另一条仍留给本回合。
    expect(claims.settle(1)).toEqual(['s-1'])
  })

  it('records no decision when the turn has no pending signal', async () => {
    runningTicket()

    await run({ ticketId: TICKET_ID, text: '契约改了' })

    expect(supplementDecisions()).toEqual([])
    expect(supplementedEvents()).toHaveLength(1)
  })

  it('rejects a signal that is not waiting in this turn', async () => {
    runningTicket()
    deliverSignal('pa-perception:1', 's-1', 2)

    await expect(run({ ticketId: TICKET_ID, text: '契约改了', signalId: 's-1' })).rejects.toMatchObject({
      code: 'invalid-signal',
    })
    expect(host.sessions.get(WORKER)?.delivered).toEqual([])
    expect(supplementedEvents()).toEqual([])
  })

  it('fails when it cannot tell which session is calling', async () => {
    runningTicket()
    const executionWithoutAgent = { ...execution(), agent: undefined } as unknown as ToolRunContext

    await expect(
      makeTool().execute({ ticketId: TICKET_ID, text: '契约改了' }, executionWithoutAgent),
    ).rejects.toMatchObject({ code: 'no-active-session' })
    expect(supplementedEvents()).toEqual([])
  })

  it('fails when the ticket does not exist', async () => {
    await expect(run({ ticketId: TICKET_ID, text: '契约改了' })).rejects.toMatchObject({
      code: 'ticket-not-found',
    })
    expect(supplementedEvents()).toEqual([])
  })

  it('fails while the ticket is still queued', async () => {
    queueTicket()

    await expect(run({ ticketId: TICKET_ID, text: '契约改了' })).rejects.toMatchObject({
      code: 'ticket-not-running',
    })
    expect(supplementedEvents()).toEqual([])
  })

  it('tells the caller to append a new ticket once this one ended', async () => {
    runningTicket()
    closeTicket()

    await expect(run({ ticketId: TICKET_ID, text: '契约改了' })).rejects.toThrow(/append|追加/i)
    expect(supplementedEvents()).toEqual([])
  })

  it('fails when the worker session has no live agent', async () => {
    runningTicket()
    host.sessions.delete(WORKER)

    await expect(run({ ticketId: TICKET_ID, text: '契约改了' })).rejects.toMatchObject({
      code: 'session-not-live',
    })
    expect(supplementedEvents()).toEqual([])
  })

  it('reports a delivery failure without recording a supplement', async () => {
    runningTicket()
    host.failNextSteer('inbox rejected the message')

    await expect(run({ ticketId: TICKET_ID, text: '契约改了' })).rejects.toMatchObject({
      code: 'delivery-failed',
    })
    expect(supplementedEvents()).toEqual([])
  })

  it('delivers the same text to the same ticket only once', async () => {
    runningTicket()
    const tool = makeTool()

    const first = await run({ ticketId: TICKET_ID, text: '契约改了' }, tool)
    const second = await run({ ticketId: TICKET_ID, text: '契约改了' }, tool)

    expect(first.status).toBe('delivered')
    expect(second.status).toBe('already-queued')
    expect(host.sessions.get(WORKER)?.delivered).toHaveLength(1)
    expect(supplementedEvents()).toHaveLength(1)
  })
})
