// src/host/signals/claim.ts
//
// 认领登记：进程内记录「哪条信号属于哪个回合、已经被谁取用」。
//
// 配对过程本身不是账本事实，所以这里不落账；账本只记信号与最终的决定。
// 代价是重启后配对关系丢失——已经投递但未结算的信号会停在待处理，事件页如实
// 显示，不做自动收口。

export type ClaimOutcome =
  | { ok: true; signalId?: string }
  | { ok: false; reason: 'unknown-signal' }

export interface ClaimRegistry {
  /** 信号已入账：把消息与信号对应起来，等回合取用时再归入回合。 */
  record(messageId: string, signalId: string): void
  /** 消息被某个回合取用：它的信号从此属于该回合。 */
  onClaimed(messageId: string, turn: number): void
  /** 处理类工具认领一条信号：显式优先，否则取本回合最早的未认领信号。 */
  claim(turn: number, explicitSignalId?: string): ClaimOutcome
  /** 回合结束：取出仍未认领的信号并清空该回合。 */
  settle(turn: number): string[]
}

export function createClaimRegistry(): ClaimRegistry {
  /** 已入账但尚未进入某个回合的消息。 */
  const signalByMessage = new Map<string, string>()
  /** 每个回合可被认领的信号，按到达顺序排列。 */
  const pendingByTurn = new Map<number, string[]>()

  function takeFrom(pending: string[], index: number): string | undefined {
    const [signalId] = pending.splice(index, 1)
    return signalId
  }

  return {
    record(messageId, signalId) {
      // 同一条消息只对应一条信号：重复观察不能多出一次可认领的机会。
      if (signalByMessage.has(messageId)) return
      signalByMessage.set(messageId, signalId)
    },

    onClaimed(messageId, turn) {
      const signalId = signalByMessage.get(messageId)
      if (signalId === undefined) return
      signalByMessage.delete(messageId)
      const pending = pendingByTurn.get(turn) ?? []
      if (!pending.includes(signalId)) pending.push(signalId)
      pendingByTurn.set(turn, pending)
    },

    claim(turn, explicitSignalId) {
      const pending = pendingByTurn.get(turn)
      if (explicitSignalId !== undefined) {
        // 显式指认必须落在本回合：跨回合绑定会让事件页的结局失真。
        const index = pending?.indexOf(explicitSignalId) ?? -1
        if (pending === undefined || index < 0) return { ok: false, reason: 'unknown-signal' }
        const claimed = takeFrom(pending, index)
        if (pending.length === 0) pendingByTurn.delete(turn)
        return claimed === undefined ? { ok: true } : { ok: true, signalId: claimed }
      }

      if (pending === undefined) return { ok: true }
      const claimed = takeFrom(pending, 0)
      if (pending.length === 0) pendingByTurn.delete(turn)
      return claimed === undefined ? { ok: true } : { ok: true, signalId: claimed }
    },

    settle(turn) {
      const pending = pendingByTurn.get(turn)
      if (pending === undefined) return []
      pendingByTurn.delete(turn)
      // 返回副本：结算方拿着这个列表去写决定，不能反过来改这里的状态。
      return [...pending]
    },
  }
}
