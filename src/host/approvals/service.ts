// src/host/approvals/service.ts
//
// 审批决定的三支路（方案 §6.2）：先读 pending，再按目标 worker 的状态选择
// 销毁（已归档）/ inline（工具正阻塞）/ followup（agent 存在但已停止）。
// 顺序是「先送达、后记账」：decided 只在送达成功后写入。

import type { SessionId } from '@deepseek-ai/dsh-session'
import type { ApprovalDecision, ApprovalView } from '../../shared/approvals.ts'
import { DECISION_ERROR_CODES, type DecisionErrorCode, type DecisionResponse } from '../../shared/api.ts'
import type { HostContext } from '../context.ts'
import { deliverToSession } from '../sessions/delivery.ts'
import type { EventStore } from '../store/event-store.ts'
import { approvalCorrelationId } from './ids.ts'
import { formatApprovalDelivery } from './message.ts'
import type { ResolverRegistry } from './resolvers.ts'

export interface ApprovalDeciderOptions {
  ctx: HostContext
  store: EventStore
  resolvers: ResolverRegistry
  now?: () => number
}

export interface DecisionOutcome {
  status: number
  body: DecisionResponse
}

export interface ApprovalDecider {
  decide(approvalId: string, request: unknown): Promise<DecisionOutcome>
}

export class DecisionInputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DecisionInputError'
  }
}

export function createApprovalDecider(options: ApprovalDeciderOptions): ApprovalDecider {
  const now = options.now ?? Date.now

  return {
    async decide(approvalId, request) {
      const approval = options.store
        .projection()
        .approvals.find(item => item.id === approvalId)
      if (approval === undefined) {
        return failure(404, DECISION_ERROR_CODES.notFound, `审批 ${approvalId} 不存在或已作废`)
      }
      if (approval.decidedAt !== undefined) {
        return failure(409, DECISION_ERROR_CODES.alreadyDecided, `审批 ${approvalId} 已经处理过`)
      }

      let decision: ApprovalDecision
      try {
        decision = parseDecisionRequest(approval, request)
      } catch (error) {
        return failure(
          400,
          DECISION_ERROR_CODES.invalidDecision,
          error instanceof Error ? error.message : String(error),
        )
      }

      // 支路 a：目标会话已归档 → 审批作废，不产生决策数据。
      if (options.ctx.workspaceRegistry.archivedSessionIds.includes(approval.requestedBySessionId as SessionId)) {
        options.store.append({
          type: 'approval/discarded',
          actor: 'system',
          correlationId: approvalCorrelationId(approval.id, approval.ticketId),
          payload: {
            approvalId,
            reason: 'worker-archived',
            discardedAt: now(),
          },
        })
        return failure(
          409,
          DECISION_ERROR_CODES.workerArchived,
          `审批 ${approvalId} 已作废：执行会话已被归档`,
        )
      }

      const decidedAt = now()

      // 支路 b：工具仍在阻塞 → 先送达并等待工具确认，再记账。
      const resolver = options.resolvers.find(approvalId)
      if (resolver !== undefined) {
        const delivered = await resolver.deliver({ decision, decidedAt })
        if (delivered) {
          appendDecided(options, approval, decision, decidedAt, 'inline')
          return { status: 200, body: { ok: true, transport: 'inline' } }
        }
        // 工具恰在送达时中止：按 followup 重新送达一次。
      }

      // 支路 c：agent 存在但已停止 → followup 投递决定消息。
      try {
        await deliverToSession(options.ctx, approval.requestedBySessionId as SessionId, {
          requestId: `pa-approval-delivery:${approvalId}`,
          text: formatApprovalDelivery(approval, decision),
        })
      } catch (error) {
        return failure(
          502,
          DECISION_ERROR_CODES.deliveryFailed,
          `审批 ${approvalId} 送达失败：${error instanceof Error ? error.message : String(error)}`,
        )
      }

      appendDecided(options, approval, decision, decidedAt, 'followup')
      return { status: 200, body: { ok: true, transport: 'followup' } }
    },
  }
}

/** 校验并构造人的决定；错误消息要能让调用方知道改哪一项。 */
export function parseDecisionRequest(approval: ApprovalView, request: unknown): ApprovalDecision {
  if (typeof request !== 'object' || request === null || Array.isArray(request)) {
    throw new DecisionInputError('决定必须是一个对象')
  }
  const raw = request as Record<string, unknown>
  const decision: ApprovalDecision = { kind: 'skipped' }

  if (raw.kind === 'selected') {
    const index = raw.index
    if (!Number.isInteger(index) || (index as number) < 0 || (index as number) >= approval.options.length) {
      throw new DecisionInputError(`选中的选项下标无效：${String(index)}`)
    }
    const option = approval.options[index as number]
    if (option === undefined) throw new DecisionInputError(`选中的选项下标无效：${String(index)}`)
    decision.kind = 'selected'
    decision.index = index as number
    decision.label = option.label
  } else if (raw.kind !== 'skipped') {
    throw new DecisionInputError('kind 必须是 selected 或 skipped')
  }

  if (raw.note !== undefined) {
    if (typeof raw.note !== 'string') throw new DecisionInputError('note 必须是字符串')
    if (raw.note.trim().length > 0) decision.note = raw.note.trim()
  }

  // 未知键（例如旧客户端仍提交的 fields）不参与决定，也不报错：
  // 一次合法的选择不应该因为多带了一个已退役字段而失败。
  return decision
}

function appendDecided(
  options: ApprovalDeciderOptions,
  approval: ApprovalView,
  decision: ApprovalDecision,
  decidedAt: number,
  transport: 'inline' | 'followup',
): void {
  options.store.append({
    type: 'approval/decided',
    actor: 'human',
    correlationId: approvalCorrelationId(approval.id, approval.ticketId),
    payload: { approvalId: approval.id, decision, decidedAt, transport },
  })
}

function failure(status: number, code: DecisionErrorCode, message: string): DecisionOutcome {
  return { status, body: { ok: false, code, message } }
}
