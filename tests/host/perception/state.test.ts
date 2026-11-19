// tests/host/perception/state.test.ts
//
// 运行时状态的持久化：节流时间与 edge 状态落在 kv（允许改写），去重集合从账本
// 重建（它必须与事实同源）。两者都不进账本——「上次投递在什么时候」不是事实，
// 只是让下一次判定可用的技术状态。

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createPerceptionState, type PerceptionState } from '../../../src/host/perception/state.ts'
import { KvStore } from '../../../src/host/store/kv-store.ts'

let directory: string
let kv: KvStore
let state: PerceptionState

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'pa-state-'))
  kv = await KvStore.open({ directory })
  state = createPerceptionState(kv)
})

afterEach(async () => {
  await kv.close()
  await rm(directory, { recursive: true, force: true })
})

describe('delivery time', () => {
  it('has no delivery time before the first delivery', () => {
    expect(state.lastDeliveredAt('src-1', 'changes')).toBeUndefined()
  })

  it('remembers the last delivery', async () => {
    await state.markDelivered('src-1', 'changes', 1_700_000_000_000)

    expect(state.lastDeliveredAt('src-1', 'changes')).toBe(1_700_000_000_000)
  })

  it('keeps threads apart', async () => {
    await state.markDelivered('src-1', 'changes', 1)
    await state.markDelivered('src-2', 'changes', 2)

    expect(state.lastDeliveredAt('src-1', 'changes')).toBe(1)
    expect(state.lastDeliveredAt('src-2', 'changes')).toBe(2)
  })

  it('treats an unreadable stored time as absent', async () => {
    await kv.set('perception/src-1/changes/last-delivered', '不是时间')

    expect(state.lastDeliveredAt('src-1', 'changes')).toBeUndefined()
  })
})

describe('edge state', () => {
  it('has no state before the first delivery', () => {
    expect(state.edgeState('src-1', 'changes')).toBeUndefined()
  })

  it('remembers the state', async () => {
    await state.setEdgeState('src-1', 'changes', 'mtime:1732')

    expect(state.edgeState('src-1', 'changes')).toBe('mtime:1732')
  })
})

describe('seen facts', () => {
  it('reports an unseen fact as unseen', () => {
    expect(state.hasSeen('src-1', 'changes', 'a.txt:1')).toBe(false)
  })

  it('remembers a seen fact', () => {
    state.markSeen('src-1', 'changes', 'a.txt:1')

    expect(state.hasSeen('src-1', 'changes', 'a.txt:1')).toBe(true)
  })

  it('keeps facts apart even when identifiers contain separators', () => {
    state.markSeen('src:1', 'th', 'x')
    state.markSeen('src', '1:th', 'x')

    expect(state.hasSeen('src:1', '1:th', 'x')).toBe(false)
  })

  it('restores seen facts from the ledger and skips ones without a key', () => {
    state.restoreSeen([
      { sourceId: 'src-1', threadId: 'changes', externalId: 'a.txt:1' },
      { sourceId: 'src-1', threadId: 'changes' },
      { sourceId: 'src-1', threadId: 'changes', externalId: 'b.txt:2' },
    ])

    expect(state.hasSeen('src-1', 'changes', 'a.txt:1')).toBe(true)
    expect(state.hasSeen('src-1', 'changes', 'b.txt:2')).toBe(true)
    expect(state.hasSeen('src-1', 'changes', '')).toBe(false)
  })

  it('keeps only the newest facts', () => {
    state.restoreSeen(
      Array.from({ length: 10_001 }, (_, index) => ({
        sourceId: 'src-1',
        threadId: 'changes',
        externalId: `fact-${index}`,
      })),
    )

    expect(state.hasSeen('src-1', 'changes', 'fact-0')).toBe(false)
    expect(state.hasSeen('src-1', 'changes', 'fact-1')).toBe(true)
    expect(state.hasSeen('src-1', 'changes', 'fact-10000')).toBe(true)
  })

  it('evicts during runtime registration too', () => {
    for (let index = 0; index <= 10_000; index += 1) {
      state.markSeen('src-1', 'changes', `fact-${index}`)
    }

    expect(state.hasSeen('src-1', 'changes', 'fact-0')).toBe(false)
    expect(state.hasSeen('src-1', 'changes', 'fact-10000')).toBe(true)
  })

  it('does not grow when the same fact is restored twice', () => {
    const fact = { sourceId: 'src-1', threadId: 'changes', externalId: 'a.txt:1' }
    state.restoreSeen([fact])
    state.restoreSeen([fact])

    expect(state.hasSeen('src-1', 'changes', 'a.txt:1')).toBe(true)
  })
})

describe('forget', () => {
  it('clears every thread state of a removed source', async () => {
    await state.markDelivered('src-1', 'changes', 1)
    await state.setEdgeState('src-1', 'changes', 'mtime:1')
    await state.markDelivered('src-2', 'changes', 2)

    await state.forget('src-1', ['changes'])

    expect(state.lastDeliveredAt('src-1', 'changes')).toBeUndefined()
    expect(state.edgeState('src-1', 'changes')).toBeUndefined()
    expect(state.lastDeliveredAt('src-2', 'changes')).toBe(2)
  })
})
