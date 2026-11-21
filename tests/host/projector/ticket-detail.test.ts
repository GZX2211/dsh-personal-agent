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

function dispatchedEvent(
  seq: number,
  time = BASE + 1000,
  payload: Record<string, unknown> = {},
): L2Event {
  return event(
    seq,
    'task/dispatched',
    { ticketId: TICKET_ID, workerSessionId: WORKER, mode: 'dispatch', ...payload },
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

  it('lays out the lead and its subagents as lanes', () => {
    const detail = deriveTicketDetail({
      ticket: ticket({ dispatchedAt: BASE + 1000, workerSessionId: WORKER }),
      ledger: [signalEvent(1, 's-1', '事实'), decisionEvent(2, 's-1', 'dispatch'), queuedEvent(3), dispatchedEvent(4)],
      sessions: new Map([
        [WORKER, facts([], [{ childId: REVIEWER, childCreatedAt: BASE + 2000, name: 'reviewer' }])],
        [REVIEWER, facts()],
      ]),
      now: BASE + 3000,
    })

    // router 不占泳道：人（若参与）在最左，其次是负责人与子代理。
    expect(detail.lanes.map(lane => [lane.id, lane.index, lane.role])).toEqual([
      [WORKER, 0, 'lead'],
      [REVIEWER, 1, 'subagent'],
    ])
    expect(detail.lanes[1]).toMatchObject({ name: 'reviewer', parentId: WORKER })
    expect(detail.lanes[0]?.sessionId).toBe(WORKER)
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

    expect(detail.lanes).toEqual([])
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
    expect(detail.lanes[0]).toMatchObject({ status: 'running', currentTurn: 2, turns: 1 })
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

  it('shows a reused subagent that takes part in this window without a spawn row', () => {
    const detail = deriveTicketDetail({
      ticket: ticket({ dispatchedAt: BASE + 1000, workerSessionId: WORKER }),
      ledger: [queuedEvent(1), dispatchedEvent(2)],
      sessions: new Map([
        // 子代理是上一单创建的：本单复用它，所以只画它在本单的投递。
        [WORKER, facts([], [{ childId: REVIEWER, childCreatedAt: BASE - 5000, name: 'reviewer' }])],
        [
          REVIEWER,
          facts([
            userMessage(1, BASE + 2000, '复核完了，契约要改', {
              kind: 'agent-message',
              senderSessionId: WORKER,
            }),
          ]),
        ],
      ]),
      now: BASE + 3000,
    })

    expect(detail.rows.filter(row => row.kind === 'spawn')).toEqual([])
    expect(detail.lanes.map(lane => lane.role)).toEqual(['lead', 'subagent'])
    expect(detail.lanes[1]).toMatchObject({ id: REVIEWER, name: 'reviewer', parentId: WORKER })
    expect(detail.rows).toContainEqual(
      expect.objectContaining({ kind: 'hop', from: WORKER, to: REVIEWER, direction: 'down' }),
    )
  })

  it('draws a supplement as its own row', () => {
    const detail = deriveTicketDetail({
      ticket: ticket({ dispatchedAt: BASE + 1000, workerSessionId: WORKER }),
      ledger: [
        queuedEvent(1),
        dispatchedEvent(2),
        event(
          3,
          'task/supplemented',
          {
            ticketId: TICKET_ID,
            targetSessionId: WORKER,
            text: '接口契约改了\n按新字段名实现',
            requestedBySessionId: ROUTER,
            messageId: 'pa-delivery:pa-supplement:t-abcdef1234:abc',
          },
          { time: BASE + 2500, actor: 'router' },
        ),
      ],
      sessions: new Map([[WORKER, facts([turnStart(1, BASE + 1002)])]]),
      now: BASE + 3000,
    })

    expect(detail.rows).toContainEqual(
      expect.objectContaining({
        kind: 'supplement',
        from: 'router',
        to: WORKER,
        at: BASE + 2500,
        summary: '接口契约改了',
        text: '接口契约改了\n按新字段名实现',
      }),
    )
    expect(detail.metrics.supplements).toBe(1)
  })

  it('explains why an appended ticket waited', () => {
    const detail = deriveTicketDetail({
      ticket: ticket({ dispatchedAt: BASE + 9000, workerSessionId: WORKER }),
      ledger: [
        queuedEvent(1, { mode: 'append', workerSessionId: WORKER, queueReason: 'worker-busy' }),
        dispatchedEvent(2, BASE + 9000, { mode: 'append' }),
      ],
      sessions: new Map([[WORKER, facts([turnStart(1, BASE + 9001)])]]),
      now: BASE + 9500,
    })

    expect(detail.mode).toBe('append')
    expect(detail.rows).toContainEqual(
      expect.objectContaining({ kind: 'milestone', milestone: 'queue-busy', at: BASE + 1 }),
    )
  })

  it('draws the approval request and the human decision as two rows', () => {
    const detail = deriveTicketDetail({
      ticket: ticket({ dispatchedAt: BASE + 1000, workerSessionId: WORKER }),
      ledger: [
        queuedEvent(1),
        dispatchedEvent(2),
        event(3, 'approval/pending', {
          approvalId: 'a-1',
          ticketId: TICKET_ID,
          question: '发布到生产会立刻影响用户，要不要发？',
          options: [
            { label: '发布', description: '立刻上线' },
            { label: '等等', description: '继续观察' },
          ],
          risk: 'high',
          requestedBySessionId: WORKER,
        }, { time: BASE + 2000, actor: 'worker', sessionId: WORKER }),
        event(4, 'approval/decided', {
          approvalId: 'a-1',
          decision: { kind: 'selected', index: 0, label: '发布' },
          decidedAt: BASE + 3000,
          transport: 'inline',
        }, { time: BASE + 3000, actor: 'human' }),
      ],
      sessions: new Map([[WORKER, facts([turnStart(1, BASE + 1002)])]]),
      now: BASE + 4000,
    })

    expect(detail.rows).toContainEqual(
      expect.objectContaining({
        kind: 'approval',
        phase: 'request',
        from: WORKER,
        to: 'human',
        summary: '发布到生产会立刻影响用户，要不要发？',
        options: ['发布', '等等'],
        risk: 'high',
        at: BASE + 2000,
      }),
    )
    expect(detail.rows).toContainEqual(
      expect.objectContaining({
        kind: 'approval',
        phase: 'decision',
        from: 'human',
        to: WORKER,
        summary: '发布',
        decision: 'selected',
        at: BASE + 3000,
      }),
    )
    expect(detail.lanes.map(lane => lane.role)).toEqual(['human', 'lead'])
  })

  it('waits on the human while an approval is pending', () => {
    const detail = deriveTicketDetail({
      ticket: ticket({ stage: 'blocked', dispatchedAt: BASE + 1000, workerSessionId: WORKER }),
      ledger: [
        queuedEvent(1),
        dispatchedEvent(2),
        event(3, 'approval/pending', {
          approvalId: 'a-1',
          ticketId: TICKET_ID,
          question: '要不要发布？',
          options: [{ label: '发布', description: '上线' }],
          requestedBySessionId: WORKER,
        }, { time: BASE + 2000, actor: 'worker', sessionId: WORKER }),
      ],
      sessions: new Map([[WORKER, facts([turnStart(1, BASE + 1002)])]]),
      now: BASE + 4000,
    })

    expect(detail.rows.at(-1)).toEqual(
      expect.objectContaining({ kind: 'live', live: 'waiting-approval', lane: 'human', waitingOn: WORKER }),
    )
  })

  it('marks a discarded approval as a milestone', () => {
    const detail = deriveTicketDetail({
      ticket: ticket({ dispatchedAt: BASE + 1000, workerSessionId: WORKER }),
      ledger: [
        queuedEvent(1),
        dispatchedEvent(2),
        event(3, 'approval/pending', {
          approvalId: 'a-1',
          ticketId: TICKET_ID,
          question: '要不要发布？',
          options: [{ label: '发布', description: '上线' }],
          requestedBySessionId: WORKER,
        }, { time: BASE + 2000, actor: 'worker', sessionId: WORKER }),
        event(4, 'approval/discarded', {
          approvalId: 'a-1',
          reason: 'worker-archived',
          discardedAt: BASE + 2500,
        }, { time: BASE + 2500, actor: 'system' }),
      ],
      sessions: new Map([[WORKER, facts()]]),
      now: BASE + 4000,
    })

    expect(detail.rows).toContainEqual(
      expect.objectContaining({
        kind: 'milestone',
        milestone: 'approval-discarded',
        detail: 'worker-archived',
      }),
    )
  })

  it('merges consecutive spawns of one parent into a fan row', () => {
    const first = BASE + 1500
    const detail = deriveTicketDetail({
      ticket: ticket({ dispatchedAt: BASE + 1000, workerSessionId: WORKER }),
      ledger: [queuedEvent(1), dispatchedEvent(2)],
      sessions: new Map([
        [
          WORKER,
          facts([], [
            { childId: 'session-a', childCreatedAt: first, name: 'architect' },
            { childId: 'session-b', childCreatedAt: first + 1000, name: 'frontend' },
            { childId: 'session-c', childCreatedAt: first + 2000, name: 'reviewer' },
          ]),
        ],
      ]),
      now: BASE + 5000,
    })

    expect(detail.rows.filter(row => row.kind === 'spawn')).toEqual([])
    expect(detail.rows.filter(row => row.kind === 'fan')).toEqual([
      expect.objectContaining({
        from: WORKER,
        at: first,
        to: [
          { sessionId: 'session-a', summary: 'architect' },
          { sessionId: 'session-b', summary: 'frontend' },
          { sessionId: 'session-c', summary: 'reviewer' },
        ],
      }),
    ])
    expect(detail.metrics.parallel).toBe(3)
    expect(detail.metrics.agents).toBe(4)
  })

  it('counts back-and-forth deliveries as ping-pong', () => {
    const detail = deriveTicketDetail({
      ticket: ticket({ dispatchedAt: BASE + 1000, workerSessionId: WORKER }),
      ledger: [queuedEvent(1), dispatchedEvent(2)],
      sessions: new Map([
        [
          WORKER,
          facts(
            [userMessage(1, BASE + 2100, '复核完了吗', { kind: 'agent-message', senderSessionId: REVIEWER })],
            [{ childId: REVIEWER, childCreatedAt: BASE + 1500, name: 'reviewer' }],
          ),
        ],
        [
          REVIEWER,
          facts([
            userMessage(1, BASE + 2000, '帮我看下契约', { kind: 'agent-message', senderSessionId: WORKER }),
          ]),
        ],
      ]),
      now: BASE + 4000,
    })

    // WORKER→REVIEWER 之后紧跟 REVIEWER→WORKER：一问一答，算一次来回。
    expect(detail.metrics.hops).toBe(2)
    expect(detail.metrics.pingPong).toBe(1)
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
