// src/host/dispatcher/executor.ts
//
// 执行一个放行动作：建会话（仅 dispatch）→ 记 task/dispatched → 投递简报。
// 顺序是「先存后做」的落点：账本先确认这一单已放行，再产生唤醒 worker 的副作用。

import { join } from 'node:path'
import type { SessionId } from '@deepseek-ai/dsh-session'
import type { WorkerModel } from '../../shared/settings.ts'
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
  /** 执行环境根目录的 getter；缺省 `<state>/work`。 */
  executorRoot?: () => string
  /** 执行器模型 getter；null/缺省表示继承 DSH 默认。 */
  workerModel?: () => WorkerModel | null
  /**
   * 放行事实写完后、简报投递前调用。
   *
   * worker agent 在 `task/dispatched` 之前就已创建并发布 `agent/created`，此刻账本
   * 还没绑定它，装饰器无法按工单识别角色；必须在这里补一次装饰，否则 worker 会
   * 带着默认提示词与工具跑第一步。
   */
  onWorkerReady?: (sessionId: SessionId) => Promise<void> | void
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
    // 入队后目标会话可能已被归档或销毁。先确认它还有活 Agent，再写放行事实：
    // 否则工单会停在「进行中」而没有任何执行者，且无法再被调度。
    const resolved = await deps.ctx.sessionController.resolveAgent(sessionId)
    if (!('agent' in resolved)) {
      throw new Error(`append target ${sessionId} has no live agent: ${resolved.error.code}`)
    }
  } else {
    const root = deps.executorRoot?.() ?? join(deps.stateDirectory, 'work')
    const worker = await createWorkerSession(deps.ctx, root, {
      ticketId: ticket.id,
      title: ticket.title,
      directory: ticket.directory,
      model: deps.workerModel?.() ?? null,
      ...(deps.log === undefined ? {} : { log: deps.log }),
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

  // 账本已经确认放行，worker 的会话身份也已可用：先装上角色能力，再投递简报。
  await deps.onWorkerReady?.(sessionId)

  const text = formatTaskBrief(
    {
      ticketId: ticket.id,
      title: ticket.title,
      goal: ticket.goal,
      directory,
    },
    mode,
  )
  try {
    await deliverToSession(deps.ctx, sessionId, {
      requestId: ticketDeliveryRequestId(ticket.id),
      text,
      target: 'followup',
      ticketId: ticket.id,
    })
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
