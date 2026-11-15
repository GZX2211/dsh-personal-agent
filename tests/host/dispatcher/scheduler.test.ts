// tests/host/dispatcher/scheduler.test.ts
//
// 调度器 = 计划 + 副作用：槽位、追加优先、worker 忙碌、失败重试与重入都在这层。
// 用真实账本与伪宿主，验证「放行之后账本与投递同时成立」。

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createScheduler, type Scheduler } from '../../../src/host/dispatcher/scheduler.ts'
import { EventStore } from '../../../src/host/store/event-store.ts'
import { createFakeHost, type FakeHost } from '../../support/fake-host.ts'

let directory: string
let store: EventStore
let host: FakeHost
let logs: string[]

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'pa-sched-'))
  store = await EventStore.open({ directory })
  host = createFakeHost()
  logs = []
})

afterEach(async () => {
  store.close()
  await rm(directory, { recursive: true, force: true })
})

function makeScheduler(maxWorkers = 5): Scheduler {
  return createScheduler({
    ctx: host.ctx,
    store,
    stateDirectory: directory,
    maxWorkers,
    log: message => logs.push(message),
  })
}

function seedQueued(ticketId: string, options: { mode?: 'dispatch' | 'append'; workerSessionId?: string } = {}): void {
  store.append({
    type: 'task/queued',
    actor: 'router',
    correlationId: ticketId,
    payload: {
      ticketId,
      title: `任务 ${ticketId}`,
      goal: '把事做完',
      mode: options.mode ?? 'dispatch',
      ...(options.workerSessionId === undefined ? {} : { workerSessionId: options.workerSessionId }),
    },
  })
}

function seedClosed(ticketId: string): void {
  store.append({
    type: 'task/closed',
    actor: 'system',
    correlationId: ticketId,
    payload: { ticketId, outcome: 'completed' },
  })
}

describe('createScheduler', () => {
  it('dispatches queued tickets up to the capacity', async () => {
    const scheduler = makeScheduler(2)
    seedQueued('t-1')
    seedQueued('t-2')
    seedQueued('t-3')

    await scheduler.trigger('test')

    const stages = store.projection().tickets.map(ticket => ticket.stage)
    expect(stages).toEqual(['running', 'running', 'queued'])
    expect(host.createCalls).toBe(2)
  })

  it('does nothing when the queue is empty', async () => {
    const scheduler = makeScheduler()

    await scheduler.trigger('test')
    await scheduler.idle()

    expect(host.createCalls).toBe(0)
    expect(logs).toEqual([])
  })

  it('dispatches the next ticket after a slot is released', async () => {
    const scheduler = makeScheduler(1)
    seedQueued('t-1')
    seedQueued('t-2')
    await scheduler.trigger('first')

    seedClosed('t-1')
    await scheduler.trigger('slot-released')

    expect(store.projection().tickets.map(ticket => ticket.stage)).toEqual(['ended', 'running'])
    expect(host.createCalls).toBe(2)
  })

  it('appends to an idle worker instead of creating a session', async () => {
    const scheduler = makeScheduler()
    seedQueued('t-1')
    await scheduler.trigger('dispatch')
    const workerSessionId = store.projection().tickets[0]?.workerSessionId
    expect(workerSessionId).toBeDefined()
    seedClosed('t-1')

    seedQueued('t-2', { mode: 'append', workerSessionId })
    await scheduler.trigger('append')

    expect(host.createCalls).toBe(1)
    expect(store.projection().tickets[1]).toMatchObject({
      stage: 'running',
      workerSessionId,
    })
    expect(host.sessions.get(workerSessionId ?? '')?.delivered).toHaveLength(2)
  })

  it('keeps an append queued while its worker is busy', async () => {
    const scheduler = makeScheduler()
    seedQueued('t-1')
    await scheduler.trigger('dispatch')
    const workerSessionId = store.projection().tickets[0]?.workerSessionId ?? ''
    seedQueued('t-2', { mode: 'append', workerSessionId })

    await scheduler.trigger('append')

    expect(store.projection().tickets[1]?.stage).toBe('queued')
    expect(host.sessions.get(workerSessionId)?.delivered).toHaveLength(1)

    seedClosed('t-1')
    await scheduler.trigger('worker-idle')

    expect(store.projection().tickets[1]?.stage).toBe('running')
    expect(host.sessions.get(workerSessionId)?.delivered).toHaveLength(2)
    expect(host.createCalls).toBe(1)
  })

  it('keeps an append queued when its worker session is gone', async () => {
    const scheduler = makeScheduler()
    seedQueued('t-1', { mode: 'append', workerSessionId: 'session-gone' })

    await scheduler.trigger('append')

    expect(store.projection().tickets[0]?.stage).toBe('queued')
    expect(host.createCalls).toBe(0)
  })

  it('does not run two rounds concurrently', async () => {
    const scheduler = makeScheduler()
    seedQueued('t-1')
    seedQueued('t-2')

    await Promise.all([scheduler.trigger('a'), scheduler.trigger('b'), scheduler.trigger('c')])
    await scheduler.idle()

    expect(host.createCalls).toBe(2)
    expect(store.projection().tickets.map(ticket => ticket.stage)).toEqual(['running', 'running'])
  })

  it('stops the round on a failed dispatch and retries on the next trigger', async () => {
    const scheduler = makeScheduler()
    host.failNextCreate('session controller is unavailable')
    seedQueued('t-1')
    seedQueued('t-2')

    await scheduler.trigger('first')

    expect(store.projection().tickets.map(ticket => ticket.stage)).toEqual(['queued', 'queued'])
    expect(logs.some(message => message.includes('session controller is unavailable'))).toBe(true)

    await scheduler.trigger('retry')

    expect(store.projection().tickets.map(ticket => ticket.stage)).toEqual(['running', 'running'])
    expect(host.createCalls).toBe(3)
  })
})
