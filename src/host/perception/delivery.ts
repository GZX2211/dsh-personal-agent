// src/host/perception/delivery.ts
//
// 把一条感知事实投递进 router 的 inbox。
//
// 顺序是「先投递、后记账」：账本记录的事实是「已经进入 router inbox」，投递成功才
// 成立。记账由观察者完成（它看到 inbox splice 才写 signal/received），所以这里只
// 负责让消息确实进队列，并返回观察者将会派生的那个 signalId。

import type { SessionId } from '@deepseek-ai/dsh-session'
import type { HostContext } from '../context.ts'
import { createPerceptionMessage, perceptionMessageId } from '../sessions/message.ts'
import { deliveredSignalId } from '../signals/identity.ts'

export interface PerceptionNotice {
  sourceId: string
  sourceName: string
  threadId: string
  threadName: string
  /** 来源侧去重键；决定消息身份与投递幂等。 */
  externalId: string
  /** 事实陈述（模板已渲染）。 */
  statement: string
  /** 抢在 router 当前回合的下一步之前投递。 */
  interrupt: boolean
  /** 事实发生时刻；缺省用投递时刻。 */
  at?: number
}

export type PerceptionDeliveryOutcome =
  | { delivered: true; signalId: string; messageId: string }
  | { delivered: false; reason: 'router-unavailable' | 'already-queued' }

export interface PerceptionDeliveryOptions {
  ctx: HostContext
  currentRouterSessionId: () => SessionId | undefined
}

export async function deliverPerceptionNotice(
  options: PerceptionDeliveryOptions,
  notice: PerceptionNotice,
): Promise<PerceptionDeliveryOutcome> {
  const routerSessionId = options.currentRouterSessionId()
  if (routerSessionId === undefined) return { delivered: false, reason: 'router-unavailable' }

  const messageId = perceptionMessageId(notice.sourceId, notice.threadId, notice.externalId)
  const resolved = await options.ctx.sessionController.resolveAgent(routerSessionId)
  if (!('agent' in resolved)) return { delivered: false, reason: 'router-unavailable' }

  const agent = resolved.agent
  const queued = [...agent.inbox.nextTurn, ...agent.inbox.nextStep].some(message => message.id === messageId)
  if (queued) return { delivered: false, reason: 'already-queued' }

  // 与观察者用同一个派生函数：正文里写的 signalId 就是账本里将要出现的那一个。
  const signalId = deliveredSignalId(routerSessionId, messageId)
  const message = createPerceptionMessage({ ...notice, signalId, at: notice.at ?? Date.now() })
  if (notice.interrupt) agent.steer(message)
  else agent.followup(message)
  await options.ctx.sessionPersistence.flush()
  return { delivered: true, signalId, messageId }
}
