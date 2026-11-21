// src/host/tools/turn-signal.ts
//
// 处理类工具共用的信号认领：把「这次动作处理的是哪条输入」绑定到当前回合。
//
// 配对是进程内事实，不落账；失败时也不该留下账本痕迹，因此这里只返回结果，
// 由各工具换成自己的稳定错误码。

import type { Agent } from '@deepseek-ai/dsh-agent'
import type { HostContext } from '../context.ts'
import type { ClaimRegistry } from '../signals/claim.ts'

/** `signalId` 缺失表示本回合没有待处理信号：闲聊里发起的动作同样合法。 */
export type TurnSignalClaim = { ok: true; signalId?: string } | { ok: false }

export function claimTurnSignal(
  ctx: HostContext,
  claims: ClaimRegistry,
  agent: Agent,
  explicitSignalId: string | undefined,
): TurnSignalClaim {
  // 当前回合从会话的回合边界投影读取：工具执行上下文里没有 turn 字段。
  const turn = ctx.agents.turnBoundaryOf(agent.session).lastTurn
  const outcome = claims.claim(turn, explicitSignalId)
  return outcome.ok ? outcome : { ok: false }
}
