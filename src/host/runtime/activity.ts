// src/host/runtime/activity.ts
//
// 最近 7 天信号活动：按本地自然日聚合投递/过滤计数。账本是唯一事实来源，
// 这里只维护一份 O(1)/信号的内存索引，供快照组装时现算窗口。

import type { L2Event } from '../../shared/events.ts'
import type { ActivityStats, DayActivity } from '../../shared/runtime.ts'
import type { EventStore } from '../store/event-store.ts'

interface Bucket {
  delivered: number
  filtered: number
}

export class ActivityIndex {
  readonly #unsubscribe: () => void
  readonly #days = new Map<number, Bucket>()

  private constructor(store: EventStore) {
    for (const event of store.events()) this.record(event)
    this.#unsubscribe = store.subscribe(event => this.record(event))
  }

  static open(store: EventStore): ActivityIndex {
    return new ActivityIndex(store)
  }

  record(event: L2Event): void {
    if (event.type !== 'signal/received') return
    // 用 receivedAt 而不是账本 time：前者是信号真正到达的时刻。
    const day = localDayStart(event.payload.receivedAt)
    const bucket = this.#days.get(day) ?? { delivered: 0, filtered: 0 }
    if (event.payload.delivered) bucket.delivered += 1
    else bucket.filtered += 1
    this.#days.set(day, bucket)
  }

  view(now: number): ActivityStats {
    const todayStart = localDayStart(now)
    const days: DayActivity[] = []
    for (let offset = -6; offset <= 0; offset += 1) {
      const start = localDayStartWithOffset(todayStart, offset)
      const bucket = this.#days.get(start) ?? { delivered: 0, filtered: 0 }
      days.push({ start, ...bucket })
    }
    // 只保留窗口内的桶，避免进程长跑后 Map 无限增长。
    const oldest = days[0]?.start ?? todayStart
    for (const key of this.#days.keys()) {
      if (key < oldest) this.#days.delete(key)
    }
    const today = days[days.length - 1] ?? { start: todayStart, delivered: 0, filtered: 0 }
    return { today, days }
  }

  close(): void {
    this.#unsubscribe()
  }
}

/** 本地自然日 00:00。 */
export function localDayStart(time: number): number {
  const date = new Date(time)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

/** 相对某天 00:00 偏移 N 个本地自然日；用 Date 构造器而不是减 86400000，跨 DST 也正确。 */
export function localDayStartWithOffset(dayStart: number, offset: number): number {
  const date = new Date(dayStart)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + offset).getTime()
}

export function emptyActivity(now: number): ActivityStats {
  const start = localDayStart(now)
  const days: DayActivity[] = []
  for (let offset = -6; offset <= 0; offset += 1) {
    days.push({ start: localDayStartWithOffset(start, offset), delivered: 0, filtered: 0 })
  }
  return { today: days[days.length - 1] ?? { start, delivered: 0, filtered: 0 }, days }
}
