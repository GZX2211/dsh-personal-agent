// tests/host/runtime/workers.test.ts
//
// Worker 运行时只做两件事：把「工单还开着」对应到活 Agent 的会话，并把会话里
// 的轮次/usage/窗口折叠成概览需要的只读事实。断言落在 viewWorkers() 的结果，
// 不读内部记录。

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { EventDraft } from '../../../src/shared/events.ts'
import { EventStore } from '../../../src/host/store/event-store.ts'
import { WorkerRuntimeRegistry } from '../../../src/host/runtime/workers.ts'
import { createFakeHost, type FakeHost } from '../../support/fake-host.ts'

const TICKET_ID = 't-aaa1112223'
const SESSION = 'session-worker-1'
const T0 = 1_700_000_000_000

let directory: string
const stores: EventStore[] = []
const registries: WorkerRuntimeRegistry[] = []

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'pa-workers-'))
})

afterEach(async () => {
  for (const registry of registries.splice(0)) registry.close()
  for (const store of stores.splice(0)) store.close()
  await rm(directory, { recursive: true, force: true })
})

async function openStore(): Promise<EventStore> {
  const store = await EventStore.open({ directory, now: () => T0 })
  stores.push(store)
  return store
}

function queuedDraft(ticketId = TICKET_ID): EventDraft {
  return {
    type: 'task/queued',
    actor: 'router',
    correlationId: ticketId,
    payload: { ticketId, title: '修复登录超时', goal: '把登录修好', mode: 'dispatch' },
  }
}

function dispatchedDraft(ticketId = TICKET_ID): EventDraft {
  return {
    type: 'task/dispatched',
    actor: 'system',
    correlationId: ticketId,
    payload: { ticketId, workerSessionId: SESSION, mode: 'dispatch' },
  }
}

function closedDraft(ticketId = TICKET_ID): EventDraft {
  return {
    type: 'task/closed',
    actor: 'system',
    correlationId: ticketId,
    payload: { ticketId, outcome: 'completed' },
  }
}

interface Harness {
  store: EventStore
  host: FakeHost
}

async function openHarness(
  options: { live?: boolean; status?: 'idle' | 'running'; window?: number } = {},
): Promise<Harness> {
  const store = await openStore()
  store.append(queuedDraft())
  store.append(dispatchedDraft())
  const host = createFakeHost({
    liveSessionIds: options.live === false ? [] : [SESSION],
  })
  const session = host.sessions.get(SESSION)
  if (session !== undefined) {
    session.agent.status = options.status ?? 'idle'
    if (options.window !== undefined) session.agent.session.requestWindow = options.window
  }
  return { store, host }
}

function openRegistry(
  store: EventStore,
  host: FakeHost,
  log?: (message: string) => void,
): WorkerRuntimeRegistry {
  const registry = WorkerRuntimeRegistry.open({ ctx: host.ctx, store, ...(log === undefined ? {} : { log }) })
  registries.push(registry)
  return registry
}

describe('WorkerRuntimeRegistry', () => {
  it('registers a dispatched ticket with no turn or context', async () => {
    const { store, host } = await openHarness()
    const registry = openRegistry(store, host)

    expect(registry.viewWorkers(store.projection())).toEqual([
      { ticketId: TICKET_ID, workerSessionId: SESSION, live: 'idle', turn: 0 },
    ])
  })

  it('adopts the turn from turn/start', async () => {
    const { store, host } = await openHarness()
    const registry = openRegistry(store, host)

    host.emitSessionEvent(SESSION, { type: 'turn/start', seq: 1, time: T0 + 1_000, data: { turn: 2 } })

    expect(registry.viewWorkers(store.projection())[0]).toMatchObject({
      turn: 2,
      lastActivityAt: T0 + 1_000,
    })
  })

  it('counts prompt tokens from input plus cache read and write', async () => {
    const { store, host } = await openHarness()
    const registry = openRegistry(store, host)

    host.emitSessionEvent(SESSION, {
      type: 'assistant/message',
      seq: 1,
      time: T0 + 2_000,
      data: {
        turn: 1,
        step: 0,
        message: {},
        stream: [],
        usage: {
          inputTokens: 1_000,
          outputTokens: 50,
          cacheReadTokens: 200,
          cacheWriteTokens: 30,
        },
      },
    })

    expect(registry.viewWorkers(store.projection())[0]?.context).toEqual({ usedTokens: 1_230 })
  })

  it('takes the window from request/context and clears it when the route stops reporting', async () => {
    const { store, host } = await openHarness({ window: 800_000 })
    const registry = openRegistry(store, host)

    host.emitSessionEvent(SESSION, {
      type: 'assistant/message',
      seq: 1,
      time: T0 + 1_000,
      data: {
        turn: 1,
        step: 0,
        message: {},
        stream: [],
        usage: { inputTokens: 480_000, outputTokens: 10 },
      },
    })
    host.emitSessionEvent(SESSION, {
      type: 'request/context',
      seq: 2,
      time: T0 + 2_000,
      data: { provider: 'fake', model: 'fake-model', contextWindow: 640_000 },
    })

    expect(registry.viewWorkers(store.projection())[0]?.context).toEqual({
      usedTokens: 480_000,
      windowTokens: 640_000,
    })

    host.emitSessionEvent(SESSION, {
      type: 'request/context',
      seq: 3,
      time: T0 + 3_000,
      data: { provider: 'fake', model: 'fake-model' },
    })

    expect(registry.viewWorkers(store.projection())[0]?.context).toEqual({ usedTokens: 480_000 })
  })

  it('reports running, idle and offline from the live agent registry', async () => {
    const { store, host } = await openHarness({ status: 'running' })
    const registry = openRegistry(store, host)
    const session = host.sessions.get(SESSION)

    expect(registry.viewWorkers(store.projection())[0]?.live).toBe('running')

    if (session === undefined) throw new Error('fake session missing')
    session.agent.status = 'idle'
    expect(registry.viewWorkers(store.projection())[0]?.live).toBe('idle')

    host.sessions.delete(SESSION)
    expect(registry.viewWorkers(store.projection())[0]?.live).toBe('offline')
  })

  it('initializes a worker whose agent appears after the ticket was registered', async () => {
    const { store, host } = await openHarness({ live: false })
    const registry = openRegistry(store, host)

    expect(registry.viewWorkers(store.projection())[0]?.live).toBe('offline')

    const session = host.addSession(SESSION)
    session.agent.session.requestWindow = 1_000_000
    host.emitSessionEvent(SESSION, { type: 'turn/start', seq: 1, time: T0 + 1_000, data: { turn: 1 } })
    host.emitSessionEvent(SESSION, {
      type: 'assistant/message',
      seq: 2,
      time: T0 + 2_000,
      data: {
        turn: 1,
        step: 0,
        message: {},
        stream: [],
        usage: { inputTokens: 1_000, outputTokens: 10 },
      },
    })

    expect(registry.viewWorkers(store.projection())[0]).toMatchObject({
      live: 'idle',
      turn: 1,
      context: { usedTokens: 1_000, windowTokens: 1_000_000 },
    })
  })

  it('reads the existing log once so a restarted ticket keeps its turn and usage', async () => {
    const store = await openStore()
    store.append(queuedDraft())
    store.append(dispatchedDraft())
    const host = createFakeHost({ liveSessionIds: [SESSION] })
    const session = host.sessions.get(SESSION)
    if (session === undefined) throw new Error('fake session missing')
    session.agent.session.requestWindow = 800_000
    host.emitSessionEvent(SESSION, { type: 'turn/start', seq: 1, time: T0 + 1_000, data: { turn: 3 } })
    host.emitSessionEvent(SESSION, {
      type: 'assistant/message',
      seq: 2,
      time: T0 + 2_000,
      data: {
        turn: 3,
        step: 0,
        message: {},
        stream: [],
        usage: { inputTokens: 5_000, outputTokens: 20 },
      },
    })

    const registry = openRegistry(store, host)

    expect(registry.viewWorkers(store.projection())[0]).toMatchObject({
      turn: 3,
      lastActivityAt: T0 + 2_000,
      context: { usedTokens: 5_000, windowTokens: 800_000 },
    })
  })

  it('drops a worker when its ticket closes', async () => {
    const { store, host } = await openHarness()
    const registry = openRegistry(store, host)

    store.append(closedDraft())

    expect(registry.viewWorkers(store.projection())).toEqual([])
  })

  it('lists only open tickets that have a worker session', async () => {
    const { store, host } = await openHarness()
    const registry = openRegistry(store, host)
    store.append(queuedDraft('t-bbb2223334'))

    expect(registry.viewWorkers(store.projection()).map(worker => worker.ticketId)).toEqual([TICKET_ID])
  })

  it('does not list a queued append ticket that has not been dispatched', async () => {
    const { store, host } = await openHarness()
    const registry = openRegistry(store, host)
    store.append({
      type: 'task/queued',
      actor: 'router',
      correlationId: 't-bbb2223334',
      payload: {
        ticketId: 't-bbb2223334',
        title: '追加任务',
        goal: '继续做',
        mode: 'append',
        workerSessionId: SESSION,
        queueReason: 'worker-busy',
      },
    })

    expect(registry.viewWorkers(store.projection()).map(worker => worker.ticketId)).toEqual([TICKET_ID])
  })

  it('survives a session log that cannot be read', async () => {
    const { store, host } = await openHarness()
    const session = host.sessions.get(SESSION)
    if (session === undefined) throw new Error('fake session missing')
    session.agent.session.snapshotEvents = () => {
      throw new Error('log unavailable')
    }
    const logs: string[] = []

    expect(() => openRegistry(store, host, message => logs.push(message))).not.toThrow()

    const registry = openRegistry(store, host)
    expect(registry.viewWorkers(store.projection())).toHaveLength(1)
    expect(logs.some(message => message.includes('log unavailable'))).toBe(true)
  })
})
