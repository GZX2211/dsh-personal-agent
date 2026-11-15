// src/host/approvals/heal.ts
//
// 启动自愈（方案 §6.4）：inline 支路已送达、decided 未落盘时崩溃，重启后审批仍是
// 待审批。这里只读 worker 会话日志，找该审批工具结果里持久化的决定，补写
// approval/decided{recovered:true}；找不到就保持待审批，绝不猜。

import type { SessionId } from '@deepseek-ai/dsh-session'
import type { ApprovalDecision } from '../../shared/approvals.ts'
import type { HostContext } from '../context.ts'
import { readSessionEvents } from '../sessions/log-reader.ts'
import type { EventStore } from '../store/event-store.ts'
import { isApprovalDecisionRecord } from '../store/payload-spec.ts'

export interface HealOptions {
  ctx: HostContext
  store: EventStore
  log?: (message: string) => void
}

/** 返回补写的条数；失败只记日志，不阻断启动。 */
export async function healPendingApprovals(options: HealOptions): Promise<number> {
  let healed = 0

  for (const approval of options.store.projection().approvals) {
    if (approval.decidedAt !== undefined) continue
    try {
      const recovered = await recoverFromSessionLog(
        options.ctx,
        approval.requestedBySessionId as SessionId,
        approval.id,
      )
      if (recovered === undefined) continue
      options.store.append({
        type: 'approval/decided',
        actor: 'system',
        correlationId: approval.ticketId,
        payload: {
          approvalId: approval.id,
          decision: recovered.decision,
          decidedAt: recovered.decidedAt,
          transport: 'inline',
          recovered: true,
        },
      })
      healed += 1
      options.log?.(`recovered approval ${approval.id} from its delivered tool result`)
    } catch (error) {
      options.log?.(
        `self-heal skipped approval ${approval.id}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  return healed
}

interface RecoveredDecision {
  decision: ApprovalDecision
  decidedAt: number
}

async function recoverFromSessionLog(
  ctx: HostContext,
  sessionId: SessionId,
  approvalId: string,
): Promise<RecoveredDecision | undefined> {
  const events = await readSessionEvents(ctx, sessionId)
  for (const event of events) {
    if (event.type !== 'tool/result') continue
    const meta = event.data.meta
    if (typeof meta !== 'object' || meta === null || Array.isArray(meta)) continue
    const record = meta as { approvalId?: unknown; decision?: unknown; decidedAt?: unknown }
    if (record.approvalId !== approvalId) continue
    if (!isApprovalDecisionRecord(record.decision)) continue
    if (typeof record.decidedAt !== 'number' || !Number.isFinite(record.decidedAt)) continue
    return { decision: record.decision as ApprovalDecision, decidedAt: record.decidedAt }
  }
  return undefined
}
