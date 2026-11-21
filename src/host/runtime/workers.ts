// src/host/runtime/workers.ts
//
// 进行中工单的运行时读模型：把工单的 workerSessionId 对应到活 Agent，折叠回合号、
// 最近一次请求的提示词 token、模型窗口与会话最后活动时间。只读，不写账本；
// 所有观察失败都降级为日志，不能让会话写入或快照端点失败。

import type { Session, SessionEvent, SessionId } from '@deepseek-ai/dsh-session'
import type { TokenUsage } from '@deepseek-ai/dsh-llm'
import type { L2Event } from '../../shared/events.ts'
import type { WorkerRuntimeView } from '../../shared/runtime.ts'
import type { TicketStage } from '../../shared/tickets.ts'
import type { HostContext } from '../context.ts'
import type { Projection } from '../projector/project.ts'
import type { EventStore } from '../store/event-store.ts'

interface WorkerRecord {
  sessionId: SessionId
  turn: number
  initialized: boolean
  lastActivityAt?: number
  usedTokens?: number
  windowTokens?: number
}

export interface WorkerRuntimeRegistryOptions {
  ctx: HostContext
  store: EventStore
  log?: (message: string) => void
}

export class WorkerRuntimeRegistry {
  readonly #ctx: HostContext
  readonly #store: EventStore
  readonly #records = new Map<string, WorkerRecord>()
  readonly #disposers: (() => void)[] = []
  readonly #log?: (message: string) => void

  private constructor(options: WorkerRuntimeRegistryOptions) {
    this.#ctx = options.ctx
    this.#store = options.store
    this.#log = options.log
    // 启动时把还在执行的工单会话登记进来；之后由 task/dispatched 增量登记。
    for (const ticket of options.store.projection().tickets) {
      if (ticket.workerSessionId !== undefined && isOpen(ticket.stage)) {
        this.track(ticket.workerSessionId as SessionId)
      }
    }
    this.#disposers.push(options.store.subscribe(event => this.onStoreEvent(event)))
    this.#disposers.push(options.ctx.on('session/event', (session, event) => this.onSessionEvent(session, event)))
  }

  static open(options: WorkerRuntimeRegistryOptions): WorkerRuntimeRegistry {
    return new WorkerRuntimeRegistry(options)
  }

  track(sessionId: SessionId): void {
    if (this.#records.has(sessionId)) return
    const record: WorkerRecord = { sessionId, turn: 0, initialized: false }
    this.#records.set(sessionId, record)
    this.ensureInitialized(record)
  }

  forget(sessionId: string): void {
    this.#records.delete(sessionId)
  }

  view(sessionId: string): Omit<WorkerRuntimeView, 'ticketId'> {
    const agent = this.#ctx.agents.get(sessionId as SessionId)
    const live = agent === undefined ? 'offline' : agent.status === 'running' ? 'running' : 'idle'
    const record = this.#records.get(sessionId)
    if (record === undefined) {
      return { workerSessionId: sessionId, live, turn: 0 }
    }
    this.ensureInitialized(record)
    const context =
      record.usedTokens === undefined
        ? undefined
        : {
            usedTokens: record.usedTokens,
            ...(record.windowTokens === undefined ? {} : { windowTokens: record.windowTokens }),
          }
    return {
      workerSessionId: sessionId,
      live,
      turn: record.turn,
      ...(record.lastActivityAt === undefined ? {} : { lastActivityAt: record.lastActivityAt }),
      ...(context === undefined ? {} : { context }),
    }
  }

  viewWorkers(projection: Projection): WorkerRuntimeView[] {
    return projection.tickets
      .filter(ticket => isOpen(ticket.stage) && ticket.workerSessionId !== undefined)
      .map(ticket => {
        const sessionId = ticket.workerSessionId as string
        // 启动顺序可能让工单先出现、登记晚一步；读之前补登记，避免空窗。
        if (!this.#records.has(sessionId)) this.track(sessionId as SessionId)
        return { ticketId: ticket.id, ...this.view(sessionId) }
      })
  }

  close(): void {
    for (const dispose of this.#disposers) dispose()
    this.#disposers.length = 0
    this.#records.clear()
  }

  private initialize(record: WorkerRecord, session: Session): void {
    const route = session.requestContext()
    if (route?.contextWindow !== undefined) record.windowTokens = route.contextWindow

    // 一次性向前扫，初始化轮次 / 最近 usage / 最后活动；之后全部增量。
    // 与 sessions/observer.ts 的用法一致；Session 同步读已被标记 deprecated，
    // 若后续有替代 reader，只需替换这个方法。
    const events = session.snapshotEvents()
    for (let index = events.length - 1; index >= 0; index -= 1) {
      const event = events[index]
      if (event === undefined) continue
      record.lastActivityAt ??= event.time
      if (record.turn === 0 && event.type === 'turn/start') record.turn = event.data.turn
      if (record.usedTokens === undefined && event.type === 'assistant/message') {
        record.usedTokens = promptTokensOf(event.data.usage)
      }
    }
    record.initialized = true
  }

  /** 登记时 Agent 可能还没就绪；首次会话事件或下次快照读取时补一次初始化。 */
  private ensureInitialized(record: WorkerRecord): void {
    if (record.initialized) return
    try {
      const agent = this.#ctx.agents.get(record.sessionId)
      if (agent === undefined) return
      this.initialize(record, agent.session)
    } catch (error) {
      // 单个会话读失败只标记该记录并记日志，不能拖垮整个注册表。
      record.initialized = true
      this.#log?.(`worker runtime initialization failed for ${record.sessionId}: ${describe(error)}`)
    }
  }

  private onSessionEvent(session: Session, event: SessionEvent): void {
    const record = this.#records.get(session.id)
    if (record === undefined) return
    try {
      this.ensureInitialized(record)
      record.lastActivityAt = Math.max(record.lastActivityAt ?? 0, event.time)
      switch (event.type) {
        case 'turn/start':
          record.turn = event.data.turn
          break
        case 'assistant/message': {
          const used = promptTokensOf(event.data.usage)
          if (used !== undefined) record.usedTokens = used
          break
        }
        case 'request/context':
          record.windowTokens = event.data.contextWindow
          break
      }
    } catch (error) {
      // 观察是 best-effort：失败不能影响会话写入。
      this.#log?.(`worker runtime observation failed for ${session.id}: ${describe(error)}`)
    }
  }

  private onStoreEvent(event: L2Event): void {
    try {
      if (event.type === 'task/dispatched') {
        this.track(event.payload.workerSessionId as SessionId)
        return
      }
      if (event.type === 'task/closed') {
        const ticket = this.#store.projection().tickets.find(item => item.id === event.payload.ticketId)
        if (ticket?.workerSessionId !== undefined) this.forget(ticket.workerSessionId)
      }
    } catch (error) {
      this.#log?.(`worker runtime ledger observation failed: ${describe(error)}`)
    }
  }
}

/** 提示词侧 token：TokenUsage 的三个输入计数互斥，缓存命中/写入要加起来。 */
function promptTokensOf(usage: TokenUsage | undefined): number | undefined {
  if (usage === undefined) return undefined
  return usage.inputTokens + (usage.cacheReadTokens ?? 0) + (usage.cacheWriteTokens ?? 0)
}

/** 只有 running/blocked 占执行槽位；排队中的 append 工单虽然带着会话，也还没开始。 */
function isOpen(stage: TicketStage): boolean {
  return stage === 'running' || stage === 'blocked'
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
