// tests/host/runtime/activity.test.ts
//
// 活动索引只回答一件事：最近 7 个本地自然日各收到多少投递/过滤信号。
// 断言落在 view() 的窗口与计数上，不触碰内部 Map。

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { EventDraft } from '../../../src/shared/events.ts'
import { EventStore } from '../../../src/host/store/event-store.ts'
import {
  ActivityIndex,
  emptyActivity,
  localDayStart,
  localDayStartWithOffset,
} from '../../../src/host/runtime/activity.ts'

/** 2026-11-21 00:00（本地时区）：测试时区的锚点。 */
const TODAY = new Date(2026, 10, 21).getTime()
const HOUR = 3_600_000

let directory: string
const opened: EventStore[] = []
const indexes: ActivityIndex[] = []

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'pa-activity-'))
})

afterEach(async () => {
  for (const index of indexes.splice(0)) index.close()
  for (const store of opened.splice(0)) store.close()
  await rm(directory, { recursive: true, force: true })
})

async function openStore(now: () => number = () => TODAY + 12 * HOUR): Promise<EventStore> {
  const store = await EventStore.open({ directory, now })
  opened.push(store)
  return store
}

function openIndex(store: EventStore): ActivityIndex {
  const index = ActivityIndex.open(store)
  indexes.push(index)
  return index
}

function signalDraft(seed: number, receivedAt: number, delivered = true): EventDraft {
  const signalId = `s-${String(seed).padStart(10, '0')}`
  return {
    type: 'signal/received',
    actor: 'system',
    correlationId: signalId,
    payload: {
      kind: 'perception',
      delivered,
      receivedAt,
      signalId,
      sourceId: 'src-1',
    },
  }
}

describe('ActivityIndex', () => {
  it('replays historical signals into the local day they arrived', async () => {
    const store = await openStore()
    store.append(signalDraft(1, TODAY + 8 * HOUR))
    store.append(signalDraft(2, TODAY - 2 * HOUR, false))

    const activity = openIndex(store).view(TODAY + 12 * HOUR)

    expect(activity.today).toEqual({ start: TODAY, delivered: 1, filtered: 0 })
    expect(activity.days[5]).toEqual({ start: TODAY - 24 * HOUR, delivered: 0, filtered: 1 })
  })

  it('counts signals appended after the index opened', async () => {
    const store = await openStore()
    const index = openIndex(store)
    store.append(signalDraft(1, TODAY + 9 * HOUR))
    store.append(signalDraft(2, TODAY + 10 * HOUR, false))

    expect(index.view(TODAY + 12 * HOUR).today).toEqual({
      start: TODAY,
      delivered: 1,
      filtered: 1,
    })
  })

  it('splits delivered and filtered counts within one day', async () => {
    const store = await openStore()
    const index = openIndex(store)
    store.append(signalDraft(1, TODAY + 1 * HOUR))
    store.append(signalDraft(2, TODAY + 2 * HOUR))
    store.append(signalDraft(3, TODAY + 3 * HOUR, false))

    expect(index.view(TODAY + 12 * HOUR).today).toEqual({
      start: TODAY,
      delivered: 2,
      filtered: 1,
    })
  })

  it('returns seven local days, oldest first, ending with today', async () => {
    const store = await openStore()
    const activity = openIndex(store).view(TODAY + 12 * HOUR)

    expect(activity.days).toHaveLength(7)
    expect(activity.days.map(day => day.start)).toEqual([
      localDayStartWithOffset(TODAY, -6),
      localDayStartWithOffset(TODAY, -5),
      localDayStartWithOffset(TODAY, -4),
      localDayStartWithOffset(TODAY, -3),
      localDayStartWithOffset(TODAY, -2),
      localDayStartWithOffset(TODAY, -1),
      TODAY,
    ])
    expect(activity.days.every(day => day.delivered === 0 && day.filtered === 0)).toBe(true)
    expect(activity.today).toEqual(activity.days[6])
  })

  it('rolls the window across local midnight', async () => {
    const store = await openStore()
    const index = openIndex(store)
    store.append(signalDraft(1, TODAY - 1 * HOUR))
    store.append(signalDraft(2, TODAY + 0.5 * HOUR))

    const beforeMidnight = index.view(TODAY + 12 * HOUR)
    const afterMidnight = index.view(TODAY + 30 * HOUR)

    expect(beforeMidnight.today).toEqual({ start: TODAY, delivered: 1, filtered: 0 })
    expect(afterMidnight.today).toEqual({
      start: localDayStartWithOffset(TODAY, 1),
      delivered: 0,
      filtered: 0,
    })
    expect(afterMidnight.days[5]).toEqual({ start: TODAY, delivered: 1, filtered: 0 })
    expect(afterMidnight.days[4]).toEqual({ start: TODAY - 24 * HOUR, delivered: 1, filtered: 0 })
  })

  it('ignores events that are not signals', async () => {
    const store = await openStore()
    store.append({
      type: 'task/queued',
      actor: 'router',
      correlationId: 't-abcdef1234',
      payload: { ticketId: 't-abcdef1234', title: '发布', goal: '发出去', mode: 'dispatch' },
    })

    const activity = openIndex(store).view(TODAY + 12 * HOUR)

    expect(activity.days.every(day => day.delivered === 0 && day.filtered === 0)).toBe(true)
  })

  it('stops counting after close', async () => {
    const store = await openStore()
    const index = openIndex(store)
    index.close()
    store.append(signalDraft(1, TODAY + 9 * HOUR))

    expect(index.view(TODAY + 12 * HOUR).today.delivered).toBe(0)
  })
})

describe('local day helpers', () => {
  it('normalizes a timestamp to local midnight', () => {
    expect(localDayStart(TODAY + 17 * HOUR + 42 * 60_000)).toBe(TODAY)
  })

  it('moves by calendar days across a month boundary', () => {
    const december31 = new Date(2025, 11, 31).getTime()

    expect(localDayStartWithOffset(december31, 1)).toBe(new Date(2026, 0, 1).getTime())
    expect(localDayStartWithOffset(december31, -1)).toBe(new Date(2025, 11, 30).getTime())
  })

  it('builds an empty seven-day window with today last', () => {
    const activity = emptyActivity(TODAY + 12 * HOUR)

    expect(activity.days).toHaveLength(7)
    expect(activity.today).toEqual({ start: TODAY, delivered: 0, filtered: 0 })
    expect(activity.days[0]?.start).toBe(localDayStartWithOffset(TODAY, -6))
  })
})
