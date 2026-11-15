// src/host/dispatcher/scheduler.ts
//
// 调度器把纯计划接到真实副作用上：每轮只执行计划里的第一个动作，成功后再重新
// 计算——失败或状态变化都不会让已过期的计划继续生效。重入用「进行中标记 +
// 尾部重跑」：调度期间的新触发只登记一次，等本轮结束后补跑。

import type { SessionId } from '@deepseek-ai/dsh-session'
import type { HostContext } from '../context.ts'
import type { Projection } from '../projector/project.ts'
import type { EventStore } from '../store/event-store.ts'
import { executeDispatchAction, type DispatchOutcome } from './executor.ts'
import { planDispatch, type DispatchAction, type QueuedTicket, type WorkerState } from './plan.ts'

export interface SchedulerOptions {
  ctx: HostContext
  store: EventStore
  stateDirectory: string
  /** 执行槽位上限（方案 §5.3，默认 5）。 */
  maxWorkers: number
  /** 放行后、投递前的准备钩子（用于给新建 worker 装角色能力）。 */
  onWorkerReady?: (sessionId: SessionId) => Promise<void> | void
  log?: (message: string) => void
}

export interface Scheduler {
  /** 触发一次调度；已在跑时只登记尾部重跑，不并行执行。 */
  trigger(reason: string): Promise<void>
  /** 等到当前这轮（含尾部重跑）结束。 */
  idle(): Promise<void>
}

/** 单轮动作上限：任何数据异常都不该让调度器无限自转。 */
const MAX_ACTIONS_PER_ROUND = 100

export function createScheduler(options: SchedulerOptions): Scheduler {
  let running: Promise<void> | undefined
  let rerun = false

  const log = (message: string): void => options.log?.(message)

  async function execute(action: DispatchAction): Promise<DispatchOutcome> {
    const ticket = options.store.projection().tickets.find(item => item.id === action.ticketId)
    if (ticket === undefined) throw new Error(`ticket ${action.ticketId} disappeared from the projection`)
    return executeDispatchAction(
      {
        ctx: options.ctx,
        stateDirectory: options.stateDirectory,
        store: options.store,
        ...(options.onWorkerReady === undefined ? {} : { onWorkerReady: options.onWorkerReady }),
        log,
      },
      action,
      ticket,
    )
  }

  async function drain(): Promise<void> {
    for (let guard = 0; guard < MAX_ACTIONS_PER_ROUND; guard += 1) {
      const action = nextAction(options)
      if (action === undefined) return
      try {
        const outcome = await execute(action)
        log(`ticket ${outcome.ticketId} ${outcome.mode === 'dispatch' ? 'dispatched' : 'appended'}`)
      } catch (error) {
        // 本轮到此为止：失败的那一单仍是待处理，下一次触发会重新计划。
        log(`dispatch stopped on ${action.ticketId}: ${describe(error)}`)
        return
      }
    }
    log('dispatch scheduler hit the per-round action limit')
  }

  function trigger(reason: string): Promise<void> {
    if (running !== undefined) {
      rerun = true
      return running
    }
    const current = drain()
      .catch((error: unknown) => {
        log(`dispatch scheduler failed (${reason}): ${describe(error)}`)
      })
      .finally(() => {
        running = undefined
        if (rerun) {
          rerun = false
          void trigger('rerun')
        }
      })
    running = current
    return current
  }

  return {
    trigger,
    idle: () => running ?? Promise.resolve(),
  }
}

/** 当前状态下计划里的第一个动作。 */
function nextAction(options: SchedulerOptions): DispatchAction | undefined {
  const projection = options.store.projection()
  const inFlight = projection.tickets.filter(
    ticket => ticket.stage === 'running' || ticket.stage === 'blocked',
  ).length
  return planDispatch(
    queuedTickets(projection, options.store),
    workerStates(projection, options.store),
    options.maxWorkers - inFlight,
  )[0]
}

/** 待处理工单的队列项：模式与追加目标只存在于入队事件里。 */
function queuedTickets(projection: Projection, store: EventStore): QueuedTicket[] {
  const queued = new Set(
    projection.tickets.filter(ticket => ticket.stage === 'queued').map(ticket => ticket.id),
  )
  const latest = new Map<string, QueuedTicket>()
  for (const event of store.events()) {
    if (event.type !== 'task/queued') continue
    const ticketId = event.payload.ticketId
    if (!queued.has(ticketId)) continue
    latest.set(ticketId, {
      ticketId,
      mode: event.payload.mode,
      ...(event.payload.workerSessionId === undefined
        ? {}
        : { workerSessionId: event.payload.workerSessionId as SessionId }),
      enqueuedSeq: event.seq,
    })
  }
  return [...latest.values()]
}

/** 所有出现过的 worker 会话；有未结束工单的算忙碌。 */
function workerStates(projection: Projection, store: EventStore): WorkerState[] {
  const busy = new Set<string>()
  for (const ticket of projection.tickets) {
    if (
      ticket.workerSessionId !== undefined &&
      (ticket.stage === 'running' || ticket.stage === 'blocked')
    ) {
      busy.add(ticket.workerSessionId)
    }
  }
  const known = new Set<string>(busy)
  for (const event of store.events()) {
    if (event.type === 'task/dispatched') known.add(event.payload.workerSessionId)
    else if (event.type === 'task/queued' && event.payload.workerSessionId !== undefined) {
      known.add(event.payload.workerSessionId)
    }
  }
  return [...known].map(sessionId => ({ sessionId: sessionId as SessionId, busy: busy.has(sessionId) }))
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
