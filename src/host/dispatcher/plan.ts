// src/host/dispatcher/plan.ts
//
// 放行是纯计算（方案 §5.4）：输入队列、worker 忙碌状态与剩余槽位，输出按序执行
// 的动作。它不建会话、不写账本——那些是执行器的事，纯函数才可被穷举测试。

import type { SessionId } from '@deepseek-ai/dsh-session'
import type { TaskMode } from '../../shared/events.ts'
import type { QueueReason } from '../../shared/tickets.ts'

export interface QueuedTicket {
  ticketId: string
  mode: TaskMode
  /** `append` 的目标 worker 会话。 */
  workerSessionId?: SessionId
  /** 入队顺序（`task/queued` 的 seq）：FIFO 的唯一依据。 */
  enqueuedSeq: number
}

export interface WorkerState {
  sessionId: SessionId
  /** 有未结束工单的 worker 视为忙碌；忙碌的追加只能继续排队。 */
  busy: boolean
}

export type DispatchAction =
  | { kind: 'start-append'; ticketId: string; sessionId: SessionId }
  | { kind: 'start-dispatch'; ticketId: string }

/**
 * 计算本轮可以放行的动作。
 *
 * 规则：先按入队序消化 `append`（复用旧会话、不新开会话），再按入队序开 `dispatch`；
 * 每个动作占一个槽位，忙碌的 worker 不再接单。目标会话不在 `workers` 里的追加
 * 一律跳过（会话已被归档或销毁，交给上层报错而不是在这里猜测）。
 */
export function planDispatch(
  queue: readonly QueuedTicket[],
  workers: readonly WorkerState[],
  capacity: number,
): DispatchAction[] {
  let free = Math.max(0, Math.floor(capacity))
  const busy = new Map<SessionId, boolean>(workers.map(worker => [worker.sessionId, worker.busy]))
  const ordered = [...queue].sort((left, right) => left.enqueuedSeq - right.enqueuedSeq)
  const actions: DispatchAction[] = []

  for (const ticket of ordered) {
    if (free <= 0) break
    if (ticket.mode !== 'append' || ticket.workerSessionId === undefined) continue
    if (busy.get(ticket.workerSessionId) !== false) continue
    actions.push({ kind: 'start-append', ticketId: ticket.ticketId, sessionId: ticket.workerSessionId })
    busy.set(ticket.workerSessionId, true)
    free -= 1
  }

  for (const ticket of ordered) {
    if (free <= 0) break
    if (ticket.mode !== 'dispatch') continue
    actions.push({ kind: 'start-dispatch', ticketId: ticket.ticketId })
    free -= 1
  }

  return actions
}

/**
 * 入队时能给出的排队原因（方案 §5.5）。
 *
 * 这是「此刻会排队」的解释，不是放行承诺：真正放行仍由 `planDispatch` 决定。
 * 追加目标忙比槽位满更贴近用户的疑问，因此优先报 `worker-busy`。
 */
export function predictQueueReason(input: {
  mode: TaskMode
  workerBusy: boolean
  freeSlots: number
}): QueueReason | undefined {
  if (input.mode === 'append' && input.workerBusy) return 'worker-busy'
  if (input.freeSlots <= 0) return 'capacity-full'
  return undefined
}
