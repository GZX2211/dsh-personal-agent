// src/client/lib/approvals.ts
//
// 审批页的纯逻辑：决定构造、短码与错误码映射。不碰 React 与网络。

import type { ApprovalView } from '../../shared/approvals.ts'
import type { DecisionRequest } from '../../shared/api.ts'

/** 工单短码：与 Host 的 shortTicketId 同规则。 */
export function shortTicket(ticketId: string): string {
  return ticketId.replace(/^t-/, '').slice(0, 6)
}

/** 会话的短码：去掉 `session-` 前缀后取 8 位，用于拿不到标题时的展示。 */
export function shortSession(sessionId: string): string {
  const prefix = 'session-'
  const bare = sessionId.startsWith(prefix) ? sessionId.slice(prefix.length) : sessionId
  return bare.slice(0, 8)
}

export interface ApprovalDraft {
  /** 选中的选项下标；未选时看是否填了答案。 */
  optionIndex?: number
  /** 「输入你的答案」里的文本——人的答案，随决定一起送达 worker。 */
  answer: string
  /** 显式点「跳过」。 */
  skip?: boolean
}

/**
 * 构造提交体：选了选项走 selected，只填文本走 answered，都不填或显式跳过走 skipped。
 * 文本框内容一律作为 `answer` 随决定送达，与是否选中选项无关；选项下标非法返回 undefined。
 */
export function buildDecision(approval: ApprovalView, draft: ApprovalDraft): DecisionRequest | undefined {
  const answer = draft.answer.trim()
  const extras = answer.length === 0 ? {} : { answer }

  if (draft.skip === true) return { kind: 'skipped', ...extras }
  if (draft.optionIndex === undefined) {
    return answer.length === 0 ? { kind: 'skipped' } : { kind: 'answered', answer }
  }
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
