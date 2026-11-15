// src/host/sessions/observer.ts
//
// 观察 worker 会话的回合边界，把 L1 的 turn 事实提升为 L2 的工单事实：
// 正常结束 → 汇报 + 关闭；错误结束 → 失败关闭；用户停止 → 标记中断；
// 下一次 turn/start → 清除中断。所有写入都用同步账本 append，顺序自然稳定。

import type { Session, SessionEvent } from '@deepseek-ai/dsh-session'
import type { TicketView } from '../../shared/tickets.ts'
import type { HostContext } from '../context.ts'
import type { Scheduler } from '../dispatcher/scheduler.ts'
import type { EventStore } from '../store/event-store.ts'
import type { Projection } from '../projector/project.ts'
import { summarizeAssistantReply } from './history.ts'

export interface WorkerObserverOptions {
  ctx: HostContext
  store: EventStore
  scheduler: Scheduler
  log?: (message: string) => void
}

/** 注册观察者，返回精确的注销函数。 */
export function registerWorkerObserver(options: WorkerObserverOptions): () => void {
  return options.ctx.on('session/event', (session, event) => {
    try {
      handleSessionEvent(options, session, event)
    } catch (error) {
      // 观察是 best-effort：它失败不能影响会话本身的写入。
      options.log?.(
        `worker observation failed for ${session.id}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  })
}

function handleSessionEvent(
  options: WorkerObserverOptions,
  session: Session,
  event: SessionEvent,
): void {
  const projection = options.store.projection()
  const ticket = findOpenTicket(projection, session.id)
  if (ticket === undefined) return

  if (event.type === 'turn/start') {
    if (ticket.interrupted) {
      options.store.append({
        type: 'task/resumed',
        actor: 'system',
        correlationId: ticket.id,
        sessionId: session.id,
        payload: { ticketId: ticket.id, turn: event.data.turn },
      })
    }
    return
  }
  if (event.type !== 'turn/end') return

  switch (event.data.reason.kind) {
    case 'completed':
      finish(options, session, ticket, 'completed')
      return
    case 'error':
      finish(options, session, ticket, 'failed')
      return
    case 'max-tokens':
      // 输出被截断不代表任务完成；按失败结束，等用户重派或补充输入。
      finish(options, session, ticket, 'failed')
      return
    case 'aborted':
      markInterrupted(options, ticket, 'turn-aborted', event.data.turn)
      return
    case 'interrupted':
      // 重启时补写的合成收尾：这一回合确实没跑完。
      markInterrupted(options, ticket, 'turn-interrupted', event.data.turn)
      return
    case 'blocked':
      options.log?.(`worker ${session.id} turn blocked (archived session gate); ticket ${ticket.id} stays open`)
      return
    case 'forked':
      options.log?.(`worker ${session.id} turn ended by fork; ticket ${ticket.id} unchanged`)
      return
  }
}

function findOpenTicket(projection: Projection, sessionId: string): TicketView | undefined {
  return projection.tickets
    .filter(ticket => ticket.workerSessionId === sessionId && ticket.stage !== 'ended')
    .sort((left, right) => right.createdAt - left.createdAt || right.id.localeCompare(left.id))[0]
}

/**
 * 回合正常或失败结束：先写汇报（有文本才写），再写关闭，然后触发调度。
 *
 * 若仍有未决审批，回合不该结束；这里保持工单打开，避免把等待中的审批埋掉。
 */
function finish(
  options: WorkerObserverOptions,
  session: Session,
  ticket: TicketView,
  outcome: 'completed' | 'failed',
): void {
  const pending = options.store
    .projection()
    .approvals.some(approval => approval.ticketId === ticket.id && approval.decidedAt === undefined)
  if (pending) {
    options.log?.(`worker turn ended for ${ticket.id} while an approval is pending; leaving the ticket open`)
    return
  }

  const summary = summarizeAssistantReply(session.snapshotEvents())
  const causationId = latestTicketEventId(options.store, ticket.id)
  if (summary !== undefined) {
    options.store.append({
      type: 'task/reported',
      actor: 'worker',
      correlationId: ticket.id,
      sessionId: session.id,
      ...(causationId === undefined ? {} : { causationId }),
      payload: { ticketId: ticket.id, summary, status: outcome === 'completed' ? 'done' : 'failed' },
    })
  }
  options.store.append({
    type: 'task/closed',
    actor: 'system',
    correlationId: ticket.id,
    sessionId: session.id,
    payload: {
      ticketId: ticket.id,
      outcome,
      ...(outcome === 'failed' ? { reason: 'turn-failed' } : {}),
    },
  })
  void options.scheduler.trigger(`turn-end:${outcome}`)
}

/** 用户停止或重启中断：有未决审批时交给审批流处理，否则标一个可观察的「已中断」。 */
function markInterrupted(
  options: WorkerObserverOptions,
  ticket: TicketView,
  reason: 'turn-aborted' | 'turn-interrupted',
  turn: number,
): void {
  if (ticket.interrupted) return
  const pending = options.store
    .projection()
    .approvals.some(approval => approval.ticketId === ticket.id && approval.decidedAt === undefined)
  if (pending) return
  options.store.append({
    type: 'task/interrupted',
    actor: 'system',
    correlationId: ticket.id,
    sessionId: ticket.workerSessionId,
    payload: { ticketId: ticket.id, turn, reason },
  })
}

function latestTicketEventId(store: EventStore, ticketId: string): string | undefined {
  const events = store.events()
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]
    if (event === undefined) continue
    const payload = event.payload as { ticketId?: unknown }
    if (payload.ticketId === ticketId) return event.eventId
  }
  return undefined
}
