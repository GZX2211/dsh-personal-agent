// src/host/perception/state.ts
//
// 感知运行时状态：节流时间、edge 状态、去重集合。
//
// 前两者允许改写，落在 kv 里；去重集合必须与账本同源（它回答「这份外部事实是否已经
// 被记录过」），所以启动时从信号重建、运行期只增不减。三者都不是账本事实——账本记录
// 发生了什么，这里记录下一次判定需要知道的「上一次」。

import type { KvStore } from '../store/kv-store.ts'

const STATE_PREFIX = 'perception'

/** 去重集合的上限：近期事实足够挡住重复投递，更早的靠账本幂等兜底。 */
const SEEN_LIMIT = 10_000

export interface SeenFact {
  sourceId: string
  threadId?: string
  externalId?: string
}

export interface PerceptionState {
  lastDeliveredAt(sourceId: string, threadId: string): number | undefined
  markDelivered(sourceId: string, threadId: string, at: number): Promise<void>
  edgeState(sourceId: string, threadId: string): string | undefined
  setEdgeState(sourceId: string, threadId: string, state: string): Promise<void>
  hasSeen(sourceId: string, threadId: string, externalId: string): boolean
  markSeen(sourceId: string, threadId: string, externalId: string): void
  /** 从账本信号重建去重集合（按时间从旧到新传入）。 */
  restoreSeen(facts: Iterable<SeenFact>): void
  /** 删除来源时清掉它全部线程的运行时状态。 */
  forget(sourceId: string, threadIds: readonly string[]): Promise<void>
}

type StateStore = Pick<KvStore, 'get' | 'set' | 'deleteMany'>

export function createPerceptionState(kv: StateStore): PerceptionState {
  /** 已处理过的外部事实；Map 的插入顺序就是淘汰顺序。 */
  const seen = new Map<string, true>()

  return {
    lastDeliveredAt(sourceId, threadId) {
      const raw = kv.get(lastDeliveredKey(sourceId, threadId))
      if (raw === undefined) return undefined
      const value = Number(raw)
      return Number.isFinite(value) ? value : undefined
    },

    markDelivered(sourceId, threadId, at) {
      return kv.set(lastDeliveredKey(sourceId, threadId), String(at))
    },

    edgeState(sourceId, threadId) {
      return kv.get(edgeStateKey(sourceId, threadId))
    },

    setEdgeState(sourceId, threadId, state) {
      return kv.set(edgeStateKey(sourceId, threadId), state)
    },

    hasSeen(sourceId, threadId, externalId) {
      return seen.has(seenKey(sourceId, threadId, externalId))
    },

    markSeen(sourceId, threadId, externalId) {
      remember(seenKey(sourceId, threadId, externalId))
    },

    restoreSeen(facts) {
      for (const fact of facts) {
        // 没有外部去重键的信号（用户消息）不参与去重：它本来就不靠 externalId 认人。
        if (fact.threadId === undefined || fact.externalId === undefined) continue
        remember(seenKey(fact.sourceId, fact.threadId, fact.externalId))
      }
    },

    async forget(sourceId, threadIds) {
      const keys = threadIds.flatMap(threadId => [
        lastDeliveredKey(sourceId, threadId),
        edgeStateKey(sourceId, threadId),
      ])
      await kv.deleteMany(keys)
    },
  }

  function remember(key: string): void {
    seen.set(key, true)
    while (seen.size > SEEN_LIMIT) {
      const oldest = seen.keys().next()
      if (oldest.done === true) break
      seen.delete(oldest.value)
    }
  }
}

function lastDeliveredKey(sourceId: string, threadId: string): string {
  return `${STATE_PREFIX}/${sourceId}/${threadId}/last-delivered`
}

function edgeStateKey(sourceId: string, threadId: string): string {
  return `${STATE_PREFIX}/${sourceId}/${threadId}/edge-state`
}

/** 用 JSON 编码三个标识：来源与线程 id 里出现分隔符也不会串键。 */
function seenKey(sourceId: string, threadId: string, externalId: string): string {
  return JSON.stringify([sourceId, threadId, externalId])
}
