// tests/host/store/replay.test.ts
//
// 重放是账本唯一的读路径：文件内容 → 内存事件序列。故障注入覆盖断电残行、
// 重复行、未知类型、序号断裂与损坏载荷——每种故障都要么可降级、要么可行动地报错。

import { describe, expect, it } from 'vitest'
import type {
  L2Event,
  SignalReceivedEvent,
  TaskQueuedEvent,
} from '../../../src/shared/events.ts'
import {
  encodeLedgerLine,
  LedgerCorruptionError,
  replayLedger,
} from '../../../src/host/store/ledger-format.ts'

function eventIdFor(seq: number): string {
  return seq.toString(16).padStart(32, '0')
}

function signalEvent(seq: number, eventId = eventIdFor(seq)): SignalReceivedEvent {
  return {
    seq,
    eventId,
    type: 'signal/received',
    time: 1_700_000_000_000 + seq,
    actor: 'system',
    correlationId: 'corr-1',
    payload: { kind: 'user-message', delivered: true, receivedAt: 1_700_000_000_000 + seq },
  }
}

function queuedEvent(seq: number): TaskQueuedEvent {
  return {
    seq,
    eventId: eventIdFor(seq),
    type: 'task/queued',
    time: 1_700_000_000_000 + seq,
    actor: 'router',
    correlationId: 't-abcdef1234',
    payload: { ticketId: 't-abcdef1234', title: '发布', goal: '发布出去', mode: 'dispatch' },
  }
}

function ledgerBytes(...lines: string[]): Buffer {
  return Buffer.from(lines.join(''), 'utf8')
}

const TICKET_ID = 't-abcdef1234'

function eventAt<P extends object, T extends L2Event['type']>(seq: number, type: T, payload: P): L2Event {
  return {
    seq,
    eventId: eventIdFor(seq),
    type,
    time: 1_700_000_000_000 + seq,
    actor: 'system',
    correlationId: TICKET_ID,
    payload,
  } as L2Event
}

/**
 * 覆盖契约里全部 11 类事件的合法账本（含两类预留事件）：契约新增字段或改必填时，
 * 这条测试先坏。
 */
function fullLedger(): L2Event[] {
  return [
    eventAt(1, 'signal/received', { kind: 'user-message', delivered: true, receivedAt: 1, text: '发布 v2' }),
    eventAt(2, 'decision/recorded', { action: 'dispatch', ticketId: TICKET_ID }),
    eventAt(3, 'task/queued', { ticketId: TICKET_ID, title: '发布', goal: '发布出去', mode: 'dispatch' }),
    eventAt(4, 'task/dispatched', {
      ticketId: TICKET_ID,
      workerSessionId: 'session-worker-1',
      mode: 'dispatch',
    }),
    eventAt(5, 'approval/pending', {
      approvalId: 'a-1',
      ticketId: TICKET_ID,
      question: '发布到生产会立刻影响用户。',
      options: [{ label: '发布', description: '立刻上线' }],
      attachments: ['D:/pa-work/t-abcdef1234/notes.md'],
      risk: 'high',
      requestedBySessionId: 'session-worker-1',
    }),
    eventAt(6, 'approval/decided', {
      approvalId: 'a-1',
      decision: { kind: 'selected', index: 0, label: '发布', answer: '今晚发' },
      decidedAt: 1_700_000_000_006,
      transport: 'inline',
    }),
    eventAt(7, 'task/reported', { ticketId: TICKET_ID, summary: '发布完成', status: 'done' }),
    eventAt(8, 'task/closed', { ticketId: TICKET_ID, outcome: 'completed' }),
    eventAt(9, 'approval/discarded', {
      approvalId: 'a-2',
      reason: 'worker-archived',
      discardedAt: 1_700_000_000_009,
    }),
    eventAt(10, 'task/interrupted', { ticketId: TICKET_ID, turn: 2, reason: 'turn-aborted' }),
    eventAt(11, 'task/resumed', { ticketId: TICKET_ID, turn: 3 }),
  ]
}

describe('replayLedger', () => {
  it('returns an empty result for an empty ledger', () => {
    expect(replayLedger(Buffer.alloc(0))).toEqual({ events: [], lastSeq: 0, warnings: [] })
  })

  it('parses complete lines in file order', () => {
    const result = replayLedger(ledgerBytes(encodeLedgerLine(signalEvent(1)), encodeLedgerLine(queuedEvent(2))))

    expect(result.events).toEqual([signalEvent(1), queuedEvent(2)])
    expect(result.lastSeq).toBe(2)
    expect(result.truncateTo).toBeUndefined()
  })

  it('skips a trailing partial line and reports the bytes to truncate', () => {
    const complete = encodeLedgerLine(signalEvent(1))
    const result = replayLedger(ledgerBytes(complete, '{"seq":2,"eventId":'))

    expect(result.events).toEqual([signalEvent(1)])
    expect(result.lastSeq).toBe(1)
    expect(result.truncateTo).toBe(Buffer.byteLength(complete, 'utf8'))
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]).toMatch(/truncated/i)
  })

  it('truncates the whole file when no line is complete', () => {
    const result = replayLedger(ledgerBytes('{"seq":1'))

    expect(result.events).toEqual([])
    expect(result.truncateTo).toBe(0)
    expect(result.warnings).toHaveLength(1)
  })

  it('drops duplicate eventId lines but keeps advancing seq', () => {
    const result = replayLedger(
      ledgerBytes(encodeLedgerLine(signalEvent(1)), encodeLedgerLine(signalEvent(2, eventIdFor(1)))),
    )

    expect(result.events).toEqual([signalEvent(1)])
    expect(result.lastSeq).toBe(2)
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]).toMatch(/duplicate eventId/i)
  })

  it('skips unknown event types written by a newer version and remembers their seq', () => {
    const unknownEnvelope = {
      seq: 1,
      eventId: eventIdFor(1),
      type: 'ticket/cancelled',
      time: 1_700_000_000_001,
      actor: 'system',
      correlationId: 't-abcdef1234',
      payload: { ticketId: 't-abcdef1234' },
    }
    const result = replayLedger(ledgerBytes(`${JSON.stringify(unknownEnvelope)}\n`, encodeLedgerLine(signalEvent(2))))

    expect(result.events).toEqual([signalEvent(2)])
    expect(result.lastSeq).toBe(2)
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]).toMatch(/ticket\/cancelled/)
    expect(result.warnings[0]).toMatch(/unknown/i)
  })

  it('tolerates CRLF line endings', () => {
    const crlf = ledgerBytes(encodeLedgerLine(signalEvent(1)), encodeLedgerLine(queuedEvent(2))).toString('utf8')

    const result = replayLedger(Buffer.from(crlf.replaceAll('\n', '\r\n'), 'utf8'))

    expect(result.events.map(event => event.seq)).toEqual([1, 2])
    expect(result.warnings).toEqual([])
  })

  it('ignores blank lines without changing the sequence expectation', () => {
    const result = replayLedger(
      ledgerBytes(encodeLedgerLine(signalEvent(1)), '\n', encodeLedgerLine(queuedEvent(2))),
    )

    expect(result.events.map(event => event.seq)).toEqual([1, 2])
    expect(result.warnings).toEqual([])
  })

  it('rejects a seq gap with an actionable error', () => {
    expect(() => replayLedger(ledgerBytes(encodeLedgerLine(signalEvent(1)), encodeLedgerLine(signalEvent(3))))).toThrow(
      LedgerCorruptionError,
    )
    expect(() => replayLedger(ledgerBytes(encodeLedgerLine(signalEvent(1)), encodeLedgerLine(signalEvent(3))))).toThrow(
      /line 2.*expected seq 2.*found 3/i,
    )
  })

  it('rejects a repeated seq', () => {
    const second = { ...signalEvent(1), eventId: eventIdFor(99) }

    expect(() =>
      replayLedger(ledgerBytes(encodeLedgerLine(signalEvent(1)), encodeLedgerLine(second))),
    ).toThrow(/line 2.*seq 1.*not greater than 1/i)
  })

  it('rejects invalid JSON in a complete line', () => {
    expect(() => replayLedger(ledgerBytes('not json\n'))).toThrow(/line 1.*JSON/i)
  })

  it('rejects a known event type with a missing required payload field', () => {
    const broken: L2Event = {
      ...queuedEvent(1),
      // 故意破坏：标题必填，缺失即为损坏记录而不是可降级输入。
      payload: { ticketId: 't-abcdef1234', goal: '发布出去', mode: 'dispatch' } as TaskQueuedEvent['payload'],
    }

    expect(() => replayLedger(ledgerBytes(encodeLedgerLine(broken)))).toThrow(/line 1.*title/i)
  })

  it('rejects an unknown actor', () => {
    const broken = { ...signalEvent(1), actor: 'nobody' }

    expect(() => replayLedger(ledgerBytes(`${JSON.stringify(broken)}\n`))).toThrow(/line 1.*actor/i)
  })

  it('rejects a non-integer seq', () => {
    const broken = { ...signalEvent(1), seq: 1.5 }

    expect(() => replayLedger(ledgerBytes(`${JSON.stringify(broken)}\n`))).toThrow(/line 1.*seq/i)
  })

  it('rejects a payload that is not an object', () => {
    const broken = { ...signalEvent(1), payload: 'nope' }

    expect(() => replayLedger(ledgerBytes(`${JSON.stringify(broken)}\n`))).toThrow(/line 1.*payload/i)
  })

  it('rejects an invalid object reference', () => {
    const broken = { ...signalEvent(1), l1Ref: { sessionId: 42, seq: 0 } }

    expect(() => replayLedger(ledgerBytes(`${JSON.stringify(broken)}\n`))).toThrow(/line 1.*l1Ref/i)
  })

  it('accepts every known event type with a well-formed payload', () => {
    const ledger = fullLedger()

    const result = replayLedger(ledgerBytes(...ledger.map(event => encodeLedgerLine(event))))

    expect(result.events).toEqual(ledger)
    expect(result.lastSeq).toBe(11)
    expect(result.warnings).toEqual([])
  })

  it('accepts a standalone approval without a ticket id', () => {
    const standalone = eventAt(1, 'approval/pending', {
      approvalId: 'a-standalone',
      question: '要不要继续？',
      options: [{ label: '继续', description: '往下做' }],
      requestedBySessionId: 'session-1',
    })

    const result = replayLedger(ledgerBytes(encodeLedgerLine(standalone)))

    expect(result.events).toEqual([standalone])
    expect(result.warnings).toEqual([])
  })

  it('accepts payload fields introduced by a newer version', () => {
    const extended = { ...signalEvent(1), payload: { ...signalEvent(1).payload, futureFlag: true } }

    const result = replayLedger(ledgerBytes(`${JSON.stringify(extended)}\n`))

    expect(result.events).toHaveLength(1)
    expect(result.warnings).toEqual([])
  })

  it('rejects a malformed attachments list', () => {
    const pending = fullLedger().find(event => event.type === 'approval/pending')
    if (pending === undefined) throw new Error('approval/pending missing')
    const broken = { ...pending, seq: 1, payload: { ...pending.payload, attachments: 'notes.md' } }

    expect(() => replayLedger(ledgerBytes(`${JSON.stringify(broken)}\n`))).toThrow(/payload.attachments/i)
  })

  it('rejects an out-of-enum value in a known payload', () => {
    const broken = { ...queuedEvent(1), payload: { ...queuedEvent(1).payload, mode: 'later' } }

    expect(() => replayLedger(ledgerBytes(`${JSON.stringify(broken)}\n`))).toThrow(/line 1.*mode/i)
  })
})
