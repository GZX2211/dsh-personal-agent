// src/host/sessions/delivery.ts
//
// 向已有会话投递一条插件消息（follow-up 会唤醒它走下一个回合）。

import type { SessionId } from '@deepseek-ai/dsh-session'
import type { HostContext } from '../context.ts'
import { createDeliveryMessage, deliveryMessageId } from './message.ts'

export interface DeliveryRequest {
  /** 幂等键：同一 requestId 只投递一次。 */
  requestId: string
  text: string
}

export type DeliveryOutcome = 'delivered' | 'already-queued'

export class DeliveryError extends Error {
  constructor(readonly code: 'session-not-live', message: string) {
    super(message)
    this.name = 'DeliveryError'
  }
}

/**
 * 投递一次，返回是否真的写入。
 *
 * 幂等范围是**本进程**：只查活跃 inbox。跨进程（重启后重投）需要扫持久化历史，
 * 由审批送达在 P2 补齐，届时同一函数按 requestId 比对会话日志。
 */
export async function deliverToSession(
  ctx: HostContext,
  sessionId: SessionId,
  request: DeliveryRequest,
): Promise<DeliveryOutcome> {
  const resolved = await ctx.sessionController.resolveAgent(sessionId)
  if (!('agent' in resolved)) {
    throw new DeliveryError('session-not-live', `session ${sessionId} has no live agent: ${resolved.error.code}`)
  }
  const agent = resolved.agent
  const messageId = deliveryMessageId(request.requestId)
  const pending = [...agent.inbox.nextTurn, ...agent.inbox.nextStep].some(message => message.id === messageId)
  if (pending) return 'already-queued'

  agent.followup(createDeliveryMessage(request.requestId, request.text))
  await ctx.sessionPersistence.flush()
  return 'delivered'
}
