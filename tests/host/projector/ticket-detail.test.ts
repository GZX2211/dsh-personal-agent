// tests/host/projector/ticket-detail.test.ts
//
// 详情推导是纯函数：账本事实 + 会话窗口 → 调用链视图。断言落在页面上能看见的
// 结果（来源、泳道、行、排序、指标），不断言内部累加结构。

import type { SessionEvent } from '@deepseek-ai/dsh-session'
import { describe, expect, it } from 'vitest'
import type { L2Event } from '../../../src/shared/events.ts'
import type { TicketView } from '../../../src/shared/tickets.ts'
import {
  deriveTicketDetail,
  type DetailSessionChild,
  type DetailSessionInput,
} from '../../../src/host/projector/ticket-detail.ts'

const BASE = 1_700_000_000_000
const TICKET_ID = 't-abcdef1234'
const ROUTER = 'session-router'
const WORKER = 'session-worker'
const REVIEWER = 'session-reviewer'

function event<P extends object>(
  seq: number,
  type: L2Event['type'],
  payload: P,
  extra: { time?: number; actor?: L2Event['actor']; sessionId?: string } = {},
): L2Event {
  return {
    seq,
    eventId: `event-${seq}`,
    type,
    time: extra.time ?? BASE + seq,
    actor: extra.actor ?? 'system',
    correlationId: TICKET_ID,
    ...(extra.sessionId === undefined ? {} : { sessionId: extra.sessionId }),
    payload,
  } as L2Event
}

function signalEvent(seq: number, signalId: string, text: string): L2Event {
  return event(
    seq,
    'signal/received',
    {
      kind: 'perception',
      delivered: true,
      receivedAt: BASE,
      signalId,
      text,
      sourceName: '配置文件',
      threadName: '变更',
    },
    { actor: 'system' },
  )
}

function decisionEvent(seq: number, signalId: string, action: 'dispatch' | 'append'): L2Event {
  return event(seq, 'decision/recorded', { action, signalId, ticketId: TICKET_ID }, { actor: 'router' })
}

function queuedEvent(seq: number, payload: Record<string, unknown> = {}): L2Event {
  return event(
    seq,
    'task/queued',
    {
      ticketId: TICKET_ID,
      title: '发布 v2',
      goal: '把 v2 发出去',
      mode: 'dispatch',
      requestedBySessionId: ROUTER,
      ...payload,
    },
    { actor: 'router', sessionId: ROUTER },
  )
}

function dispatchedEvent(seq: number, time = BASE + 1000): L2Event {
  return event(
    seq,
    'task/dispatched',
    { ticketId: TICKET_ID, workerSessionId: WORKER, mode: 'dispatch' },
    { time, actor: 'system' },
  )
}

function reportedEvent(seq: number, time = BASE + 5000): L2Event {
  return event(
    seq,
    'task/reported',
    { ticketId: TICKET_ID, summary: 'v2 已上线', status: 'done' },
    { time, actor: 'worker', sessionId: WORKER },
  )
}

function closedEvent(seq: number, time = BASE + 6000, outcome: 'completed' | 'failed' = 'completed'): L2Event {
  return event(
    seq,
    'task/closed',
    { ticketId: TICKET_ID, outcome, ...(outcome === 'failed' ? { reason: 'turn-failed' } : {}) },
    { time, actor: 'system', sessionId: WORKER },
  )
}

function sessionEvent(seq: number, time: number, type: string, data: Record<string, unknown>): SessionEvent {
  return { seq, time, type, data } as SessionEvent
}

function turnStart(seq: number, time: number, turn = 1): SessionEvent {
  return sessionEvent(seq, time, 'turn/start', { turn })
}

function userMessage(
  seq: number,
  time: number,
  text: string,
  source: Record<string, unknown>,
  id = `msg-${seq}`,
): SessionEvent {
  return sessionEvent(seq, time, 'user/message', {
    id,
    role: 'user',
    content: [{ type: 'text', text }],
    source: { form: 'relay', ...source },
  })
}

function assistantMessage(
  seq: number,
  time: number,
  usage: Record<string, number>,
  turn = 1,
  step = 1,
): SessionEvent {
  return sessionEvent(seq, time, 'assistant/message', {
    turn,
    step,
    message: { role: 'assistant', content: [] },
    stream: [],
    usage,
  })
}

function facts(
  events: readonly SessionEvent[] = [],
  children: readonly DetailSessionChild[] = [],
  overrides: Partial<DetailSessionInput> = {},
): DetailSessionInput {
  return { events, children, completeness: 'full', ...overrides }
}

function ticket(overrides: Partial<TicketView> = {}): TicketView {
  return {
    id: TICKET_ID,
    shortId: 'abcdef',
    title: '发布 v2',
    stage: 'running',
    goal: '把 v2 发出去',
    createdAt: BASE,
    updatedAt: BASE,
    ...overrides,
  }
}

describe('deriveTicketDetail', () => {
  it('explains why the ticket exists', () => {
    const detail = deriveTicketDetail({
      ticket: ticket({ dispatchedAt: BASE + 1000, workerSessionId: WORKER }),
      ledger: [
        signalEvent(1, 's-1', 'app.yml 被改成 v2 的端口'),
        decisionEvent(2, 's-1', 'dispatch'),
        queuedEvent(3),
        dispatchedEvent(4),
      ],
      sessions: new Map([[WORKER, facts()]]),
      now: BASE + 2000,
    })

    expect(detail.mode).toBe('dispatch')
    expect(detail.origin).toEqual({
      signal: {
        kind: 'perception',
        text: 'app.yml 被改成 v2 的端口',
        sourceName: '配置文件',
        threadName: '变更',
        receivedAt: BASE,
      },
      decision: { action: 'dispatch', at: BASE + 2 },
      requestedBySessionId: ROUTER,
    })
  })

  it('lays out the router, the lead and its subagents as lanes', () => {
    const detail = deriveTicketDetail({
      ticket: ticket({ dispatchedAt: BASE + 1000, workerSessionId: WORKER }),
      ledger: [signalEvent(1, 's-1', '事实'), decisionEvent(2, 's-1', 'dispatch'), queuedEvent(3), dispatchedEvent(4)],
      sessions: new Map([
        [WORKER, facts([], [{ childId: REVIEWER, childCreatedAt: BASE + 2000, name: 'reviewer' }])],
        [REVIEWER, facts()],
      ]),
      now: BASE + 3000,
    })

    expect(detail.lanes.map(lane => [lane.id, lane.index, lane.role])).toEqual([
      ['router', 0, 'router'],
      [WORKER, 1, 'lead'],
      [REVIEWER, 2, 'subagent'],
    ])
    expect(detail.lanes[2]).toMatchObject({ name: 'reviewer', parentId: WORKER })
    expect(detail.lanes[0]?.sessionId).toBe(ROUTER)
  })

  it('draws the dispatch row from the ledger and the brief from the worker log', () => {
    const detail = deriveTicketDetail({
      ticket: ticket({ dispatchedAt: BASE + 1000, workerSessionId: WORKER }),
      ledger: [queuedEvent(1), dispatchedEvent(2)],
      sessions: new Map([
        [
          WORKER,
          facts([
            userMessage(
              1,
              BASE + 1001,
              '[工单] #abcdef 发布 v2\n目标：把 v2 发出去',
              { kind: 'dsh-personal-agent', ticketId: TICKET_ID },
              'pa-delivery:pa-ticket-delivery:t-abcdef1234',
            ),
            turnStart(2, BASE + 1002),
          ]),
        ],
      ]),
      now: BASE + 3000,
    })

    expect(detail.rows[0]).toMatchObject({
      kind: 'dispatch',
      from: 'router',
      to: WORKER,
      mode: 'dispatch',
      at: BASE + 1000,
      summary: '[工单] #abcdef 发布 v2',
      anchor: { sessionId: WORKER, seq: 1 },
    })
  })

  it('keeps a queued ticket without worker lanes', () => {
    const detail = deriveTicketDetail({
      ticket: ticket({ stage: 'queued', queueReason: 'capacity-full' }),
      ledger: [signalEvent(1, 's-1', '事实'), queuedEvent(2, { queueReason: 'capacity-full' })],
      sessions: new Map(),
      now: BASE + 500,
    })

    expect(detail.lanes.map(lane => lane.role)).toEqual(['router'])
    expect(detail.rows).toEqual([
      expect.objectContaining({ kind: 'milestone', milestone: 'queue-capacity', at: BASE + 2 }),
    ])
    expect(detail.completeness.logs).toBe('full')
  })

  it('ends the chain with a close milestone and carries the report', () => {
    const detail = deriveTicketDetail({
      ticket: ticket({
        stage: 'ended',
        dispatchedAt: BASE + 1000,
        endedAt: BASE + 6000,
        outcome: 'completed',
        workerSessionId: WORKER,
        report: 'v2 已上线',
      }),
      ledger: [queuedEvent(1), dispatchedEvent(2), reportedEvent(3), closedEvent(4)],
      sessions: new Map([[WORKER, facts()]]),
      now: BASE + 9000,
    })

    expect(detail.rows.at(-1)).toMatchObject({ kind: 'milestone', milestone: 'closed', at: BASE + 6000 })
    expect(detail.delivery).toEqual({ report: 'v2 已上线', outcome: 'completed' })
    expect(detail.rows.some(row => row.kind === 'live')).toBe(false)
  })

  it('marks a failed close with its reason', () => {
    const detail = deriveTicketDetail({
      ticket: ticket({
        stage: 'ended',
        dispatchedAt: BASE + 1000,
        endedAt: BASE + 6000,
        outcome: 'failed',
        workerSessionId: WORKER,
      }),
      ledger: [queuedEvent(1), dispatchedEvent(2), closedEvent(3, BASE + 6000, 'failed')],
      sessions: new Map([[WORKER, facts()]]),
      now: BASE + 9000,
    })

    expect(detail.rows.at(-1)).toMatchObject({
      kind: 'milestone',
      milestone: 'failed',
      detail: 'turn-failed',
    })
  })

  it('ends an unfinished chain with a live row for the open turn', () => {
    const detail = deriveTicketDetail({
      ticket: ticket({ dispatchedAt: BASE + 1000, workerSessionId: WORKER }),
      ledger: [queuedEvent(1), dispatchedEvent(2)],
      sessions: new Map([[WORKER, facts([turnStart(1, BASE + 1002, 2)])]]),
      now: BASE + 3000,
    })

    expect(detail.rows.at(-1)).toEqual(
      expect.objectContaining({ kind: 'live', lane: WORKER, live: 'running', turn: 2 }),
    )
    expect(detail.lanes[1]).toMatchObject({ status: 'running', currentTurn: 2, turns: 1 })
  })

  it('turns an agent message into a hop from the sender to the receiver', () => {
    const detail = deriveTicketDetail({
      ticket: ticket({ dispatchedAt: BASE + 1000, workerSessionId: WORKER }),
      ledger: [queuedEvent(1), dispatchedEvent(2)],
      sessions: new Map([
        [WORKER, facts([], [{ childId: REVIEWER, childCreatedAt: BASE + 1500, name: 'reviewer' }])],
        [
          REVIEWER,
          facts([
            turnStart(1, BASE + 1600),
            userMessage(2, BASE + 2000, '帮我复核接口契约\n顺便看下错误码', {
              kind: 'agent-message',
              senderSessionId: WORKER,
            }),
          ]),
        ],
      ]),
      now: BASE + 3000,
    })

    expect(detail.rows).toContainEqual(
      expect.objectContaining({
        kind: 'hop',
        from: WORKER,
        to: REVIEWER,
        direction: 'down',
        summary: '帮我复核接口契约',
        text: '帮我复核接口契约\n顺便看下错误码',
        at: BASE + 2000,
      }),
    )
  })

  it('counts agents, hops, turns, tokens and duration', () => {
    const detail = deriveTicketDetail({
      ticket: ticket({ dispatchedAt: BASE + 1000, workerSessionId: WORKER, endedAt: BASE + 4600 }),
      ledger: [queuedEvent(1), dispatchedEvent(2)],
      sessions: new Map([
        [
          WORKER,
          facts([
            turnStart(1, BASE + 1001),
            assistantMessage(2, BASE + 1002, { inputTokens: 100, outputTokens: 40, cacheReadTokens: 10 }),
            userMessage(3, BASE + 2000, '给 reviewer 传个话', {
              kind: 'agent-message',
              senderSessionId: REVIEWER,
            }),
          ]),
        ],
        [REVIEWER, facts([turnStart(1, BASE + 1500), assistantMessage(2, BASE + 1501, { inputTokens: 50, outputTokens: 20 })])],
      ]),
      now: BASE + 9000,
    })

    expect(detail.metrics).toEqual({
      agents: 2,
      hops: 1,
      supplements: 0,
      parallel: 0,
      pingPong: 0,
      turns: 2,
      tokens: 220,
      durationMs: 3600,
    })
  })
})
