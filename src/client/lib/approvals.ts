// src/client/lib/approvals.ts
//
// 审批页的纯逻辑：决定构造、短码与错误码映射。不碰 React 与网络。

import type { ApprovalView } from '../../shared/approvals.ts'
import type { DecisionRequest } from '../../shared/api.ts'

/** 工单短码：与 Host 的 shortTicketId 同规则。 */
export function shortTicket(ticketId: string): string {
  return ticketId.replace(/^t-/, '').slice(0, 6)
}

export interface ApprovalDraft {
  /** 选中的选项下标；未选时按「跳过」提交。 */
  optionIndex?: number
  /** 「输入你的答案」里的人类回答。 */
  note: string
}

/**
 * 构造提交体；未选选项时按「跳过」提交，选项下标非法时返回 undefined。
 *
 * 空白备注直接丢弃：账本里不该出现一个只剩空白的 note。
 */
export function buildDecision(approval: ApprovalView, draft: ApprovalDraft): DecisionRequest | undefined {
  const note = draft.note.trim()
  const extras = note.length === 0 ? {} : { note }

  if (draft.optionIndex === undefined) return { kind: 'skipped', ...extras }
  if (!Number.isInteger(draft.optionIndex) || draft.optionIndex < 0 || draft.optionIndex >= approval.options.length) {
    return undefined
  }
  return { kind: 'selected', index: draft.optionIndex, ...extras }
}

export type DecisionErrorKey =
  | 'decisionErrorAlreadyDecided'
  | 'decisionErrorNotFound'
  | 'decisionErrorWorkerArchived'
  | 'decisionErrorDeliveryFailed'
  | 'decisionErrorInvalidDecision'
  | 'decisionErrorUnknown'

/** 稳定错误码 → 词典键；未知码也要有可读文案。 */
export function decisionErrorKey(code: string): DecisionErrorKey {
  switch (code) {
    case 'already-decided':
      return 'decisionErrorAlreadyDecided'
    case 'not-found':
      return 'decisionErrorNotFound'
    case 'worker-archived':
      return 'decisionErrorWorkerArchived'
    case 'delivery-failed':
      return 'decisionErrorDeliveryFailed'
    case 'invalid-decision':
      return 'decisionErrorInvalidDecision'
    default:
      return 'decisionErrorUnknown'
  }
}
