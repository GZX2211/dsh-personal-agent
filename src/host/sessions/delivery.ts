// src/host/sessions/delivery.ts
//
// 向已有会话投递一条插件消息。送达方式由调用方按业务动作选定：follow-up 唤醒它走
// 下一个回合，steer 插进当前回合的下一步。

import type { SessionId } from '@deepseek-ai/dsh-session'
import type { HostContext } from '../context.ts'
import { createDeliveryMessage, deliveryMessageId } from './message.ts'

/** 送达方式：`followup` 起新回合；`steer` 插入当前回合，不打断进行中的工具。 */
export type DeliveryTarget = 'followup' | 'steer'

export interface DeliveryRequest {
  /** 幂等键：同一 requestId 只投递一次。 */
  requestId: string
  text: string
  /** 缺省 `followup`：与既有行为一致。 */
  target?: DeliveryTarget
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
 * 幂等范围是**本进程**：只查活跃 inbox。重启后 inbox 为空，同一 requestId 会再投
 * 一次——这是已知限制（跨进程去重需要扫持久化历史，MVP 不做）；审批送达靠「先
 * 送达、后记账」与启动自愈把重复窗口压到「decided 未落盘」这一小段。
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

  const message = createDeliveryMessage(request.requestId, request.text)
  if (request.target === 'steer') agent.steer(message)
  else agent.followup(message)
  await ctx.sessionPersistence.flush()
  return 'delivered'
}
