// tests/host/perception/channels/host-event.test.ts
//
// host-event：把账本里发生的事变成感知候选。它只订阅声明过的事件类型，并且永远
// 不订阅描述感知自身活动的事件——否则来源会感知到自己。

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { L2Event } from '../../../../src/shared/events.ts'
import type { HostEventChannel, ThreadDefinition } from '../../../../src/shared/sources.ts'
import { createHostEventChannel } from '../../../../src/host/perception/channels/host-event.ts'
import type { Candidate, ChannelContext } from '../../../../src/host/perception/types.ts'
import { EventStore } from '../../../../src/host/store/event-store.ts'

const TICKET_ID = 't-abcdef1234'

let directory: string
let store: EventStore
let candidates: Candidate[]
let warnings: string[]

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'pa-host-event-'))
  store = await EventStore.open({ directory })
  candidates = []
  warnings = []
})

afterEach(async () => {
  store.close()
  await rm(directory, { recursive: true, force: true })
})

function context(channel: HostEventChannel, threads: ThreadDefinition[] = []): ChannelContext {
  return {
    sourceId: 'src-1',
    channel,
    threads,
    emit: candidate => candidates.push(candidate),
    warn: message => warnings.push(message),
  }
}

function stopOf(channel: HostEventChannel): () => void {
  const runtime = createHostEventChannel(context(channel), { subscribeLedger: listener => store.subscribe(listener) })
  return runtime.start()
}

function seedClosed(): void {
  store.append({
    type: 'task/queued',
    actor: 'router',
    correlationId: TICKET_ID,
    payload: { ticketId: TICKET_ID, title: '发布', goal: '发布出去', mode: 'dispatch' },
  })
  store.append({
    type: 'task/closed',
    actor: 'system',
    correlationId: TICKET_ID,
    payload: { ticketId: TICKET_ID, outcome: 'completed' },
  })
}

const closedSubscription: HostEventChannel = {
  kind: 'host-event',
  subscriptions: [{ event: 'task/closed', thread: 'tickets', statement: '工单 {payload.ticketId} 以 {payload.outcome} 结束' }],
}

describe('host-event channel', () => {
  it('turns a subscribed event into a candidate', () => {
    const stop = stopOf(closedSubscription)

    seedClosed()
    stop()

    expect(candidates).toHaveLength(1)
    expect(candidates[0]).toMatchObject({
      thread: 'tickets',
      statement: `工单 ${TICKET_ID} 以 completed 结束`,
      at: expect.any(Number),
    })
    expect(candidates[0]?.externalId).toMatch(/^[0-9a-f]{32}$/)
    expect(candidates[0]?.state).toBe(candidates[0]?.externalId)
  })

  it('ignores events nobody subscribed to', () => {
    const stop = stopOf(closedSubscription)

    store.append({
      type: 'approval/pending',
      actor: 'worker',
      correlationId: 'a-1',
      payload: {
        approvalId: 'a-1',
        question: '要继续吗',
        options: [{ label: '继续', description: '往下做' }],
        requestedBySessionId: 'session-1',
      },
    })
    stop()

    expect(candidates).toEqual([])
  })

  it('produces one candidate per matching subscription', () => {
    const stop = stopOf({
      kind: 'host-event',
      subscriptions: [
        { event: 'task/closed', thread: 'tickets', statement: '工单结束' },
        { event: 'task/closed', thread: 'digest', statement: '{payload.ticketId} 已结束' },
      ],
    })

    seedClosed()
    stop()

    expect(candidates.map(candidate => candidate.thread)).toEqual(['tickets', 'digest'])
  })

  it('never senses the signals or sources it produces itself', () => {
    const stop = stopOf({
      kind: 'host-event',
      subscriptions: [
        { event: 'signal/received', thread: 'self', statement: '自己收到信号' },
        { event: 'source/updated', thread: 'self', statement: '来源变了' },
      ],
    })

    store.append({
      type: 'signal/received',
      actor: 'system',
      correlationId: 's-aaaaaaaaaa',
      payload: { kind: 'user-message', delivered: true, receivedAt: 1, signalId: 's-aaaaaaaaaa' },
    })
    stop()

    expect(candidates).toEqual([])
  })

  it('renders a missing template field as empty text', () => {
    const stop = stopOf({
      kind: 'host-event',
      subscriptions: [{ event: 'task/closed', thread: 'tickets', statement: '[{payload.ghost}]' }],
    })

    seedClosed()
    stop()

    expect(candidates[0]?.statement).toBe('[]')
  })

  it('exposes the event envelope to match expressions', () => {
    const stop = stopOf(closedSubscription)

    seedClosed()
    stop()

    expect(candidates[0]?.facts).toMatchObject({ type: 'task/closed', actor: 'system' })
  })

  it('stops producing candidates after the source stops', () => {
    const stop = stopOf(closedSubscription)
    stop()

    seedClosed()

    expect(candidates).toEqual([])
  })

  it('warns instead of throwing when the ledger is not subscribable', () => {
    const runtime = createHostEventChannel(context(closedSubscription), {})

    const stop = runtime.start()
    stop()

    expect(candidates).toEqual([])
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toMatch(/账本订阅不可用/)
  })
})

/** 供类型检查确认监听器形状：账本事件直接交给渠道。 */
type _EventListener = (event: L2Event) => void
