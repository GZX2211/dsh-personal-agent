// src/host/dispatcher/executor.ts
//
// 执行一个放行动作：建会话（仅 dispatch）→ 记 task/dispatched → 投递简报。
// 顺序是「先存后做」的落点：账本先确认这一单已放行，再产生唤醒 worker 的副作用。

import type { SessionId } from '@deepseek-ai/dsh-session'
import type { TaskMode } from '../../shared/events.ts'
import type { TicketView } from '../../shared/tickets.ts'
import type { HostContext } from '../context.ts'
import { deliverToSession } from '../sessions/delivery.ts'
import { createWorkerSession } from '../sessions/worker.ts'
import type { EventStore } from '../store/event-store.ts'
import { formatTaskBrief } from './brief.ts'
import type { DispatchAction } from './plan.ts'

export interface DispatchDependencies {
  ctx: HostContext
  stateDirectory: string
  store: EventStore
  log?: (message: string) => void
}

export interface DispatchOutcome {
  ticketId: string
  sessionId: SessionId
  mode: TaskMode
}

/** 简报的投递幂等键：同一工单永远只投递一份简报。 */
export function ticketDeliveryRequestId(ticketId: string): string {
  return `pa-ticket-delivery:${ticketId}`
}

/**
 * 放行一张工单。
 *
 * 会话创建失败时不写 `task/dispatched`：这一单仍是待处理，下一轮调度会重试。
 * 投递失败时不回滚已写入的放行事实（账本事实不可撤回），只报错让上层记日志。
 */
export async function executeDispatchAction(
  deps: DispatchDependencies,
  action: DispatchAction,
  ticket: TicketView,
): Promise<DispatchOutcome> {
  const mode: TaskMode = action.kind === 'start-append' ? 'append' : 'dispatch'

  let sessionId: SessionId
  let directory = ticket.directory
  if (action.kind === 'start-append') {
    sessionId = action.sessionId
  } else {
    const worker = await createWorkerSession(deps.ctx, deps.stateDirectory, {
      ticketId: ticket.id,
      title: ticket.title,
      directory: ticket.directory,
    })
    sessionId = worker.sessionId
    directory = worker.directory
  }

  const causationId = latestQueuedEventId(deps.store, ticket.id)
  deps.store.append({
    type: 'task/dispatched',
    actor: 'system',
    correlationId: ticket.id,
    ...(causationId === undefined ? {} : { causationId }),
    payload: {
      ticketId: ticket.id,
      workerSessionId: sessionId,
      mode,
      ...(directory === undefined ? {} : { directory }),
    },
  })

  const text = formatTaskBrief(
    {
      ticketId: ticket.id,
      title: ticket.title,
      goal: ticket.goal,
      context: ticket.context,
      constraints: ticket.constraints,
      expectedOutput: ticket.expectedOutput,
      directory,
    },
    mode,
  )
  try {
    await deliverToSession(deps.ctx, sessionId, { requestId: ticketDeliveryRequestId(ticket.id), text })
  } catch (error) {
    deps.log?.(
      `ticket ${ticket.id} dispatched to ${sessionId} but brief delivery failed: ${describe(error)}`,
    )
    throw error
  }

  return { ticketId: ticket.id, sessionId, mode }
}

/** 放行事件的父事件：该工单最后一次入队。 */
function latestQueuedEventId(store: EventStore, ticketId: string): string | undefined {
  const events = store.events()
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]
    if (event !== undefined && event.type === 'task/queued' && event.payload.ticketId === ticketId) {
      return event.eventId
    }
  }
  return undefined
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
