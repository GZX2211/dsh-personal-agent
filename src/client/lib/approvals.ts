// src/client/lib/approvals.ts
//
// 审批页的纯逻辑：决定构造、会话短码与错误码映射。不碰 React 与网络。
// 工单短码是共享规则，见 `src/shared/tickets.ts`。

import type { ApprovalView } from '../../shared/approvals.ts'
import { DECISION_ERROR_CODES, type DecisionErrorCode, type DecisionRequest } from '../../shared/api.ts'

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

/**
 * 稳定错误码 → 词典键的穷举表。
 *
 * 用 Record 而不是 switch：共享契约新增错误码时这一行会编译失败，而不是静默
 * 落进「未知错误」的通用文案。
 */
const DECISION_ERROR_KEYS: Record<DecisionErrorCode, DecisionErrorKey> = {
  [DECISION_ERROR_CODES.alreadyDecided]: 'decisionErrorAlreadyDecided',
  [DECISION_ERROR_CODES.notFound]: 'decisionErrorNotFound',
  [DECISION_ERROR_CODES.workerArchived]: 'decisionErrorWorkerArchived',
  [DECISION_ERROR_CODES.deliveryFailed]: 'decisionErrorDeliveryFailed',
  [DECISION_ERROR_CODES.invalidDecision]: 'decisionErrorInvalidDecision',
}

/** 稳定错误码 → 词典键；未知码也要有可读文案。 */
export function decisionErrorKey(code: string): DecisionErrorKey {
  return DECISION_ERROR_KEYS[code as DecisionErrorCode] ?? 'decisionErrorUnknown'
}
