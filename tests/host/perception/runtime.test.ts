// tests/host/perception/runtime.test.ts
//
// 运行时把一条候选走完「过滤 → 记录 / 投递 → 更新状态」：投递成功才消费去重机会，
// 投递失败不产生任何事实；被过滤的候选要留下一条可解释的记录。

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { SourceDefinition } from '../../../src/shared/sources.ts'
import type { PerceptionNotice } from '../../../src/host/perception/delivery.ts'
import { createPerceptionState, type PerceptionState } from '../../../src/host/perception/state.ts'
import { createSourceRuntime } from '../../../src/host/perception/runtime.ts'
import type { Candidate } from '../../../src/host/perception/types.ts'
import { filteredSignalId } from '../../../src/host/signals/identity.ts'
import { EventStore } from '../../../src/host/store/event-store.ts'
import { KvStore } from '../../../src/host/store/kv-store.ts'

const SOURCE_ID = 'src-1'
const NOW = 1_700_000_000_000

let directory: string
let store: EventStore
let kv: KvStore
let state: PerceptionState
let delivered: PerceptionNotice[]
let errors: string[]

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'pa-runtime-'))
  store = await EventStore.open({ directory })
  kv = await KvStore.open({ directory })
  state = createPerceptionState(kv)
  delivered = []
  errors = []
})

afterEach(async () => {
  store.close()
  await kv.close()
  await rm(directory, { recursive: true, force: true })
})

function definition(overrides: Partial<SourceDefinition> = {}): SourceDefinition {
  return {
    id: SOURCE_ID,
    name: '本地文件',
    enabled: true,
    channel: { kind: 'fs-watch', paths: ['D:/tmp'] },
    threads: [{ id: 'changes', name: '变更', enabled: true }],
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  }
}

function candidate(overrides: Partial<Candidate> = {}): Candidate {
  return { thread: 'changes', statement: 'a.txt 被修改', externalId: 'a.txt:1:1', ...overrides }
}

function runtime(
  options: {
    def?: SourceDefinition
    deliverFails?: boolean
  } = {},
) {
  return createSourceRuntime({
    definition: options.def ?? definition(),
    store,
    state,
    now: () => NOW,
    deliver: async notice => {
      if (options.deliverFails === true) {
        return { delivered: false, reason: 'router-unavailable' }
      }
      delivered.push(notice)
      return { delivered: true, signalId: 's-aaaaaaaaaa', messageId: 'm-1' }
    },
    onError: message => errors.push(message),
  })
}

function signalEvents() {
  return store.events().filter(event => event.type === 'signal/received')
}

describe('source runtime', () => {
  it('delivers a candidate that passes every rule', async () => {
    await runtime().accept(candidate())

    expect(delivered).toEqual([
      {
        sourceId: SOURCE_ID,
        sourceName: '本地文件',
        threadId: 'changes',
        threadName: '变更',
        externalId: 'a.txt:1:1',
        statement: 'a.txt 被修改',
        interrupt: false,
        at: NOW,
      },
    ])
    // 投递本身不记账：记账是观察者看到 inbox splice 之后的事。
    expect(signalEvents()).toEqual([])
  })

  it('marks the fact seen and records the delivery time after a successful delivery', async () => {
    await runtime().accept(candidate())

    expect(state.hasSeen(SOURCE_ID, 'changes', 'a.txt:1:1')).toBe(true)
    expect(state.lastDeliveredAt(SOURCE_ID, 'changes')).toBe(NOW)
  })

  it('keeps the edge state after delivering in edge mode', async () => {
    const def = definition({ threads: [{ id: 'changes', name: '变更', enabled: true, mode: 'edge' }] })

    await runtime({ def }).accept(candidate({ state: 'mtime:7' }))

    expect(state.edgeState(SOURCE_ID, 'changes')).toBe('mtime:7')
  })

  it('records nothing and consumes nothing when the router is unavailable', async () => {
    await runtime({ deliverFails: true }).accept(candidate())

    expect(signalEvents()).toEqual([])
    expect(state.hasSeen(SOURCE_ID, 'changes', 'a.txt:1:1')).toBe(false)
    expect(state.lastDeliveredAt(SOURCE_ID, 'changes')).toBeUndefined()
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatch(/不可用/)
  })

  it('records a signal when the candidate does not match', async () => {
    const def = definition({
      threads: [{ id: 'changes', name: '变更', enabled: true, match: { path: 'event', op: 'eq', value: 'add' } }],
    })

    await runtime({ def }).accept(candidate({ facts: { event: 'change' } }))

    expect(delivered).toEqual([])
    expect(signalEvents()).toHaveLength(1)
    expect(signalEvents()[0]?.payload).toMatchObject({
      kind: 'perception',
      delivered: false,
      rule: 'match',
      sourceId: SOURCE_ID,
      sourceName: '本地文件',
      threadId: 'changes',
      threadName: '变更',
      externalId: 'a.txt:1:1',
      text: 'a.txt 被修改',
    })
  })

  it('records a signal when the throttle window blocks the delivery', async () => {
    const def = definition({ threads: [{ id: 'changes', name: '变更', enabled: true, minGapSec: 60 }] })
    await state.markDelivered(SOURCE_ID, 'changes', NOW - 1_000)

    await runtime({ def }).accept(candidate())

    expect(delivered).toEqual([])
    expect(signalEvents()[0]?.payload).toMatchObject({ delivered: false, rule: 'min-gap' })
  })

  it('records a signal when an edge candidate did not change state', async () => {
    const def = definition({ threads: [{ id: 'changes', name: '变更', enabled: true, mode: 'edge' }] })
    await state.setEdgeState(SOURCE_ID, 'changes', 'mtime:7')

    await runtime({ def }).accept(candidate({ state: 'mtime:7' }))

    expect(delivered).toEqual([])
    expect(signalEvents()[0]?.payload).toMatchObject({ delivered: false, rule: 'no-change' })
  })

  it('records nothing for a thread that is switched off', async () => {
    const def = definition({ threads: [{ id: 'changes', name: '变更', enabled: false }] })

    await runtime({ def }).accept(candidate())

    expect(delivered).toEqual([])
    expect(signalEvents()).toEqual([])
  })

  it('drops an unknown thread silently', async () => {
    await runtime().accept(candidate({ thread: 'ghost' }))

    expect(delivered).toEqual([])
    expect(signalEvents()).toEqual([])
  })

  it('drops a fact it has already delivered', async () => {
    const run = runtime()
    await run.accept(candidate())
    await run.accept(candidate())

    expect(delivered).toHaveLength(1)
    expect(signalEvents()).toEqual([])
  })

  it('derives an external id when the channel supplied none', async () => {
    await runtime().accept(candidate({ externalId: undefined }))

    expect(delivered[0]?.externalId).toMatch(/^[0-9a-f]{16}$/)
    expect(state.hasSeen(SOURCE_ID, 'changes', delivered[0]?.externalId ?? '')).toBe(true)
  })

  it('uses the candidate time when it carries one', async () => {
    await runtime().accept(candidate({ at: NOW - 5_000 }))

    expect(delivered[0]?.at).toBe(NOW - 5_000)
  })

  it('retries a fact that could not be delivered the first time', async () => {
    const failing = createSourceRuntime({
      definition: definition(),
      store,
      state,
      now: () => NOW,
      deliver: async () => ({ delivered: false, reason: 'router-unavailable' }),
      onError: message => errors.push(message),
    })
    const working = runtime()

    await failing.accept(candidate())
    await working.accept(candidate())

    expect(delivered).toHaveLength(1)
  })

  it('gives the filtered signal the identity of the external fact', async () => {
    const def = definition({ threads: [{ id: 'changes', name: '变更', enabled: false }] })
    const enabled = definition({
      threads: [{ id: 'changes', name: '变更', enabled: true, match: { path: 'event', op: 'eq', value: 'add' } }],
    })

    await runtime({ def }).accept(candidate())
    await runtime({ def: enabled }).accept(candidate({ facts: { event: 'change' } }))

    const [event] = signalEvents()
    expect(event?.payload).toMatchObject({ delivered: false })
    expect(event?.correlationId).toBe(filteredSignalId(SOURCE_ID, 'changes', 'a.txt:1:1'))
  })
})
