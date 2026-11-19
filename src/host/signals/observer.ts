// src/host/signals/observer.ts
//
// router 会话的观察者：把 L1 的 inbox 事实提升为 L2 的信号事实。
//
// 只认 router 会话：worker 会话的回合属于工单域，由 sessions/observer 处理。
// 记录与配对都在会话写入的回调里同步完成，顺序因此自然稳定：消息先进入 inbox
// 并记下信号，被某个回合取用后归入该回合，回合结束时统一结算。

import type { UserMessage } from '@deepseek-ai/dsh-llm'
import type { Session, SessionEvent } from '@deepseek-ai/dsh-session'
import type {
  DecisionRecordedPayload,
  SignalReceivedPayload,
} from '../../shared/events.ts'
import type { HostContext } from '../context.ts'
import type { EventStore } from '../store/event-store.ts'
import { classifyInboxMessage } from './classify.ts'
import type { ClaimRegistry } from './claim.ts'
import { deliveredSignalId } from './identity.ts'

export interface RouterSignalObserverOptions {
  ctx: HostContext
  store: EventStore
  claims: ClaimRegistry
  /** router 身份是异步确定的，观察时再读。 */
  currentRouterSessionId: () => string | undefined
  now?: () => number
  log?: (message: string) => void
}

/** 注册观察者，返回精确的注销函数。 */
export function registerRouterSignalObserver(options: RouterSignalObserverOptions): () => void {
  const now = options.now ?? Date.now
  const disposers = [
    options.ctx.on('session/event', (session, event) => {
      try {
        handleSessionEvent(options, now, session, event)
      } catch (error) {
        // 观察是 best-effort：它失败不能影响会话本身的写入。
        options.log?.(`signal observation failed for ${session.id}: ${describe(error)}`)
      }
    }),
    // 认领是运行时事件而非会话日志事实，只能当场记账（重启即丢失）。
    options.ctx.on('agent/inbox/claimed', payload => {
      try {
        if (payload.agent.session.id !== options.currentRouterSessionId()) return
        options.claims.onClaimed(payload.message.id, payload.turn)
      } catch (error) {
        options.log?.(`signal claim registration failed: ${describe(error)}`)
      }
    }),
  ]

  return () => {
    for (const dispose of disposers.reverse()) dispose()
  }
}

function handleSessionEvent(
  options: RouterSignalObserverOptions,
  now: () => number,
  session: Session,
  event: SessionEvent,
): void {
  const routerSessionId = options.currentRouterSessionId()
  if (routerSessionId === undefined || session.id !== routerSessionId) return

  if (event.type === 'agent/inbox/spliced') {
    const { inserted, outcome } = event.data
    // 取消意味着这些消息不会进入任何回合；移除形态没有可记录的消息。
    if (outcome === 'canceled' || inserted.length === 0) return
    for (const message of inserted) recordSignal(options, now, routerSessionId, message)
    return
  }

  if (event.type === 'turn/end') {
    settleTurn(options, routerSessionId, event.data.turn, event.data.reason.kind)
  }
}

/**
 * 把一条进入 inbox 的消息记成信号。
 *
 * 先记账、再登记配对：配对表里的消息一定已经有对应的账本事实，结算时不会写出
 * 指向不存在信号的孤儿决定。
 */
function recordSignal(
  options: RouterSignalObserverOptions,
  now: () => number,
  sessionId: string,
  message: UserMessage,
): void {
  const fact = classifyInboxMessage(message)
  if (fact === undefined) return

  const signalId = deliveredSignalId(sessionId, message.id)
  const payload: SignalReceivedPayload = {
    kind: fact.kind,
    delivered: true,
    receivedAt: now(),
    signalId,
    messageId: message.id,
  }
  if (fact.text.length > 0) payload.text = fact.text
  if (fact.sourceId !== undefined) payload.sourceId = fact.sourceId
  if (fact.sourceName !== undefined) payload.sourceName = fact.sourceName
  if (fact.threadId !== undefined) payload.threadId = fact.threadId
  if (fact.threadName !== undefined) payload.threadName = fact.threadName

  options.store.append({
    type: 'signal/received',
    actor: 'system',
    correlationId: signalId,
    sessionId,
    payload,
  })
  options.claims.record(message.id, signalId)
}

/**
 * 回合结束：本回合里没有触发任何处理类工具的信号，一律是响应。
 *
 * 不看模型说了什么：未来外发消息这类动作同样不经过派发工具，未认领就是响应。
 * 异常结束也照样结算——回合一旦关闭，就不会再有处理动作发生，悬着只会让事件页
 * 永远停在待处理。
 */
function settleTurn(
  options: RouterSignalObserverOptions,
  sessionId: string,
  turn: number,
  reason: string,
): void {
  for (const signalId of options.claims.settle(turn)) {
    const payload: DecisionRecordedPayload = { action: 'reply', signalId, inferred: true }
    if (reason !== 'completed') payload.reason = reason
    options.store.append({
      type: 'decision/recorded',
      actor: 'system',
      correlationId: signalId,
      sessionId,
      payload,
    })
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
