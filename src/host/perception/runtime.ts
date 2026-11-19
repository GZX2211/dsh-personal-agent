// src/host/perception/runtime.ts
//
// 单个来源的执行体：一条候选走完「过滤 → 记录 / 投递 → 更新状态」。
//
// 记账发生在两个不同的地方，这是有意的：被过滤的候选由这里直接记（没有消息可观察），
// 而被投递的候选由 inbox 观察者记（它看到消息真的进了队列）。两边都不产生假事实。

import type { SignalReceivedPayload } from '../../shared/events.ts'
import type { SourceDefinition } from '../../shared/sources.ts'
import type { EventStore } from '../store/event-store.ts'
import type { PerceptionNotice, PerceptionDeliveryOutcome } from './delivery.ts'
import { judge } from './filter.ts'
import { statementFingerprint } from './fingerprint.ts'
import type { PerceptionState } from './state.ts'
import { filteredSignalId } from '../signals/identity.ts'
import type { Candidate } from './types.ts'

export interface SourceRuntimeOptions {
  definition: SourceDefinition
  store: EventStore
  state: PerceptionState
  /** 投递一条感知事实；不可投递时返回失败而不是抛错。 */
  deliver: (notice: PerceptionNotice) => Promise<PerceptionDeliveryOutcome>
  now?: () => number
  /** 运行期问题（投递失败等）回传给来源状态。 */
  onError?: (message: string) => void
}

export interface SourceRuntime {
  accept(candidate: Candidate): Promise<void>
}

export function createSourceRuntime(options: SourceRuntimeOptions): SourceRuntime {
  const now = options.now ?? Date.now

  return {
    async accept(candidate) {
      const definition = options.definition
      const thread = definition.threads.find(item => item.id === candidate.thread)
      if (thread === undefined) return

      const externalId = candidate.externalId ?? statementFingerprint(candidate.statement)
      const verdict = judge({
        thread,
        candidate,
        now: now(),
        lastDeliveredAt: options.state.lastDeliveredAt(definition.id, thread.id),
        lastState: options.state.edgeState(definition.id, thread.id),
        seen: options.state.hasSeen(definition.id, thread.id, externalId),
      })

      if (verdict.action === 'drop') return

      if (verdict.action === 'filtered') {
        recordFiltered(options, thread.id, thread.name, candidate, externalId, verdict.rule)
        return
      }

      const outcome = await options.deliver({
        sourceId: definition.id,
        sourceName: definition.name,
        threadId: thread.id,
        threadName: thread.name,
        externalId,
        statement: candidate.statement,
        interrupt: thread.interrupt === true,
        at: candidate.at ?? now(),
      })

      if (!outcome.delivered) {
        // 没送达就不算处理过：不留痕迹，也不消费这次去重机会，下一轮还能再试。
        if (outcome.reason === 'router-unavailable') {
          options.onError?.('router 会话不可用，感知消息未送达')
        }
        return
      }

      options.state.markSeen(definition.id, thread.id, externalId)
      await options.state.markDelivered(definition.id, thread.id, now())
      if (thread.mode === 'edge' && candidate.state !== undefined) {
        await options.state.setEdgeState(definition.id, thread.id, candidate.state)
      }
    },
  }
}

/**
 * 记录一条被过滤的感知信号。
 *
 * 它证明「事实到达了、但没投递」，并带上命中的规则；事件页据此区分「没发生」与
 * 「发生了但被挡住」。同一条外部事实重复到达时 identity 相同，账本幂等只留一条。
 */
function recordFiltered(
  options: SourceRuntimeOptions,
  threadId: string,
  threadName: string,
  candidate: Candidate,
  externalId: string,
  rule: 'match' | 'min-gap' | 'no-change',
): void {
  const definition = options.definition
  const signalId = filteredSignalId(definition.id, threadId, externalId)
  const payload: SignalReceivedPayload = {
    kind: 'perception',
    delivered: false,
    receivedAt: options.now?.() ?? Date.now(),
    signalId,
    sourceId: definition.id,
    sourceName: definition.name,
    threadId,
    threadName,
    externalId,
    text: candidate.statement,
    rule,
  }
  options.store.append({
    type: 'signal/received',
    actor: 'system',
    correlationId: signalId,
    payload,
  })
}
