// tests/host/store/event-store.test.ts
//
// 账本是落盘事实源：append 先写后改内存、seq 单调、eventId 幂等、重放可重建。
// 用真实临时目录（真实文件与 fsync），不 Mock 文件系统。

import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ApprovalPendingPayload, EventDraft, L2Event, TaskQueuedPayload } from '../../../src/shared/events.ts'
import { EventStore, type EventStoreOptions } from '../../../src/host/store/event-store.ts'
import { encodeLedgerLine } from '../../../src/host/store/ledger-format.ts'

const TICKET_ID = 't-abcdef1234'

let directory: string
const opened: EventStore[] = []

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'pa-store-'))
})

afterEach(async () => {
  for (const store of opened.splice(0)) store.close()
  await rm(directory, { recursive: true, force: true })
})

async function openStore(overrides: Partial<EventStoreOptions> = {}): Promise<EventStore> {
  const store = await EventStore.open({ directory, ...overrides })
  opened.push(store)
  return store
}

function ledgerPath(base = directory): string {
  return join(base, 'events.jsonl')
}

function queuedDraft(payload: Partial<TaskQueuedPayload> = {}, ticketId = TICKET_ID): EventDraft {
  return {
    type: 'task/queued',
    actor: 'router',
    correlationId: ticketId,
    payload: {
      ticketId,
      title: '发布新版本',
      goal: '把 v2 发出去',
      mode: 'dispatch',
      ...payload,
    },
  }
}

function dispatchedDraft(ticketId = TICKET_ID): EventDraft {
  return {
    type: 'task/dispatched',
    actor: 'system',
    correlationId: ticketId,
    payload: { ticketId, workerSessionId: `session-${ticketId}`, mode: 'dispatch' },
  }
}

/** 用同一个种子决定身份与到达时间：同一账本里的多次追加必须是不同的事实。 */
function signalDraft(seed = 1): EventDraft {
  const signalId = `s-${String(seed).padStart(10, '0')}`
  return {
    type: 'signal/received',
    actor: 'system',
    correlationId: signalId,
    payload: {
      kind: 'user-message',
      delivered: true,
      receivedAt: seed,
      signalId,
      text: '你好',
    },
  }
}

describe('EventStore', () => {
  it('creates the ledger file and assigns seq from 1', async () => {
    const store = await openStore({ now: () => 1_111 })

    const result = store.append(queuedDraft())

    expect(result.duplicate).toBe(false)
    expect(result.event.seq).toBe(1)
    expect(result.event.eventId).toMatch(/^[0-9a-f]{32}$/)
    expect(result.event.time).toBe(1_111)
    expect(await readFile(ledgerPath(), 'utf8')).toBe(encodeLedgerLine(result.event))
  })

  it('assigns a consecutive seq and stamps the injected clock', async () => {
    let clock = 1_000
    const store = await openStore({ now: () => (clock += 100) })

    const first = store.append(queuedDraft({}, 't-1111111111'))
    const second = store.append(queuedDraft({}, 't-2222222222'))

    expect([first.event.seq, second.event.seq]).toEqual([1, 2])
    expect([first.event.time, second.event.time]).toEqual([1_100, 1_200])
  })

  it('writes exactly one newline-terminated line per event', async () => {
    const store = await openStore()
    const { event } = store.append(signalDraft())

    const content = await readFile(ledgerPath(), 'utf8')

    expect(content.endsWith('\n')).toBe(true)
    expect(content.split('\n')).toEqual([`${JSON.stringify(event)}`, ''])
  })

  it('returns the existing event for a duplicate draft and writes nothing', async () => {
    const store = await openStore()
    const first = store.append(queuedDraft())
    const second = store.append(queuedDraft())

    expect(second.duplicate).toBe(true)
    expect(second.event).toEqual(first.event)
    expect(store.events()).toHaveLength(1)
    expect((await readFile(ledgerPath(), 'utf8')).split('\n')).toHaveLength(2)
    expect(store.projection().stats.tickets.total).toBe(1)
  })

  it('deduplicates across restarts by eventId', async () => {
    const first = await openStore()
    const original = first.append(queuedDraft()).event
    first.close()

    const reopened = await openStore()
    const duplicate = reopened.append(queuedDraft())
    const next = reopened.append(signalDraft())

    expect(duplicate.duplicate).toBe(true)
    expect(duplicate.event).toEqual(original)
    expect(next.event.seq).toBe(2)
  })

  it('replays the ledger after reopening', async () => {
    const first = await openStore()
    const appended = [first.append(queuedDraft()).event, first.append(dispatchedDraft()).event]
    first.close()

    const reopened = await openStore()

    expect(reopened.events()).toEqual(appended)
    expect(reopened.projection().tickets).toEqual([expect.objectContaining({ stage: 'running' })])
    expect(reopened.append(signalDraft()).event.seq).toBe(3)
  })

  it('truncates a partial trailing line on open and warns', async () => {
    const complete = encodeLedgerLine({
      seq: 1,
      eventId: 'a'.repeat(32),
      type: 'signal/received',
      time: 1_700_000_000_000,
      actor: 'system',
      correlationId: 'corr-1',
      payload: {
        kind: 'user-message',
        delivered: true,
        receivedAt: 1_700_000_000_000,
        signalId: 's-bbbbbbbbbb',
      },
    })
    await writeFile(ledgerPath(), `${complete}{"seq":2,"eventId":`, 'utf8')
    const warnings: string[] = []

    const store = await openStore({ onWarning: warning => warnings.push(warning) })

    expect(warnings).toHaveLength(1)
    expect(store.events()).toHaveLength(1)

    const appended = store.append(signalDraft(2))

    expect(appended.event.seq).toBe(2)
    expect(await readFile(ledgerPath(), 'utf8')).toBe(`${complete}${encodeLedgerLine(appended.event)}`)
  })

  it('fails to open a corrupt ledger with an actionable error', async () => {
    await writeFile(ledgerPath(), 'not json\n', 'utf8')

    await expect(openStore()).rejects.toThrow(/events\.jsonl line 1.*JSON/i)
  })

  it('does not reuse the seq of an unknown event type', async () => {
    const unknownEnvelope = {
      seq: 1,
      eventId: 'b'.repeat(32),
      type: 'ticket/cancelled',
      time: 1_700_000_000_000,
      actor: 'system',
      correlationId: TICKET_ID,
      payload: { ticketId: TICKET_ID },
    }
    await writeFile(ledgerPath(), `${JSON.stringify(unknownEnvelope)}\n`, 'utf8')

    const store = await openStore()
    const appended = store.append(signalDraft())

    expect(appended.event.seq).toBe(2)
  })

  it('recomputes the projection after each append', async () => {
    const store = await openStore()

    expect(store.projection().tickets).toEqual([])
    store.append(queuedDraft())
    expect(store.projection().tickets).toEqual([expect.objectContaining({ stage: 'queued' })])
    store.append(dispatchedDraft())
    expect(store.projection().tickets).toEqual([expect.objectContaining({ stage: 'running' })])
    expect(store.projection().stats.tickets).toEqual({ queued: 0, running: 1, blocked: 0, ended: 0, total: 1 })
  })

  it('rejects appends after close', async () => {
    const store = await openStore()
    store.close()

    expect(() => store.append(signalDraft())).toThrow(/closed/i)
  })

  it('returns a copy of the event list so callers cannot rewrite the ledger view', async () => {
    const store = await openStore()
    store.append(signalDraft())

    const view = store.events() as L2Event[]
    view.length = 0

    expect(store.events()).toHaveLength(1)
  })

  it('creates missing state directories', async () => {
    const nested = join(directory, 'state', 'personal-agent')
    const store = await EventStore.open({ directory: nested })
    opened.push(store)

    store.append(signalDraft())

    expect(await readFile(ledgerPath(nested), 'utf8')).toContain('"signal/received"')
  })

  it('emits no warning for a ledger that ends with a newline', async () => {
    const first = await openStore()
    first.append(signalDraft())
    first.close()

    const warnings: string[] = []
    await openStore({ onWarning: warning => warnings.push(warning) })

    expect(warnings).toEqual([])
  })

  it('keeps seq continuous across many appends and a restart', async () => {
    const first = await openStore()
    for (let index = 0; index < 25; index += 1) first.append(signalDraft(index))
    first.close()

    const reopened = await openStore()

    expect(reopened.events()).toHaveLength(25)
    expect(reopened.events().at(-1)?.seq).toBe(25)
    expect(reopened.append(signalDraft(999)).event.seq).toBe(26)
  })
})

describe('ledger read isolation', () => {
  it('freezes stored events so a caller cannot rewrite the ledger view', async () => {
    const store = await openStore()

    const { event } = store.append({
      type: 'approval/pending',
      actor: 'worker',
      correlationId: 'a-abcdef1234',
      payload: {
        approvalId: 'a-abcdef1234',
        question: '要发布吗？',
        options: [{ label: '发布', description: '立刻上线' }],
        requestedBySessionId: 'session-worker',
      },
    })

    expect(Object.isFrozen(event)).toBe(true)
    expect(Object.isFrozen(event.payload)).toBe(true)
    expect(Object.isFrozen((event.payload as ApprovalPendingPayload).options ?? [])).toBe(true)
  })

  it('keeps the projection unchanged when a caller tries to mutate a payload', async () => {
    const store = await openStore()
    store.append(queuedDraft())
    const view = store.events()[0]
    if (view === undefined) throw new Error('the appended event is missing')

    expect(() => {
      // 冻结对象在严格模式下拒绝写入：账本的只读边界因此是可观察的。
      ;(view as { payload: { title: string } }).payload.title = '被改写'
    }).toThrow(TypeError)
    expect(store.projection().tickets[0]?.title).toBe('发布新版本')
  })
})

describe('ledger subscription', () => {
  it('notifies a listener after an append', async () => {
    const store = await openStore()
    const seen: string[] = []
    store.subscribe(event => seen.push(event.type))

    store.append(queuedDraft())

    expect(seen).toEqual(['task/queued'])
  })

  it('does not notify on a duplicate append', async () => {
    const store = await openStore()
    const seen: number[] = []
    store.subscribe(event => seen.push(event.seq))

    store.append(queuedDraft())
    store.append(queuedDraft())

    expect(seen).toEqual([1])
  })

  it('stops notifying after unsubscribe', async () => {
    const store = await openStore()
    const seen: string[] = []
    const unsubscribe = store.subscribe(event => seen.push(event.type))

    unsubscribe()
    store.append(queuedDraft())

    expect(seen).toEqual([])
  })

  it('keeps appending when a listener throws', async () => {
    const warnings: string[] = []
    const store = await openStore({ onWarning: message => warnings.push(message) })
    const seen: string[] = []
    store.subscribe(() => {
      throw new Error('listener boom')
    })
    store.subscribe(event => seen.push(event.type))

    const result = store.append(queuedDraft())

    expect(result.duplicate).toBe(false)
    expect(seen).toEqual(['task/queued'])
    expect(warnings.some(message => message.includes('listener boom'))).toBe(true)
  })

  it('does not replay already stored events to a new listener', async () => {
    const first = await openStore()
    first.append(queuedDraft())
    first.close()

    const reopened = await openStore()
    const seen: string[] = []
    reopened.subscribe(event => seen.push(event.type))
    reopened.append(dispatchedDraft())

    expect(seen).toEqual(['task/dispatched'])
  })

  it('notifies a listener registered twice only once', async () => {
    const store = await openStore()
    const seen: string[] = []
    const listener = (event: { type: string }) => seen.push(event.type)

    store.subscribe(listener)
    store.subscribe(listener)
    store.append(queuedDraft())

    expect(seen).toEqual(['task/queued'])
  })
})
