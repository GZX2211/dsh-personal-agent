// src/client/lib/approvals.ts
//
// 审批页的纯逻辑：相对时间、必填校验、决定构造与错误码映射。不碰 React 与网络。

import type { ApprovalField, ApprovalView } from '../../shared/approvals.ts'
import type { DecisionRequest } from '../../shared/api.ts'

export type RelativeTimeParts =
  | { kind: 'relative'; unit: 'now' | 'minute' | 'hour' | 'day'; value: number }
  | { kind: 'absolute'; at: number }

/** 相对时间：一分钟内算「刚刚」，超过一周回落到绝对时间。 */
export function relativeTimeParts(now: number, at: number): RelativeTimeParts {
  const seconds = Math.floor(Math.max(0, now - at) / 1000)
  if (seconds < 60) return { kind: 'relative', unit: 'now', value: 0 }
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return { kind: 'relative', unit: 'minute', value: minutes }
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return { kind: 'relative', unit: 'hour', value: hours }
  const days = Math.floor(hours / 24)
  if (days < 7) return { kind: 'relative', unit: 'day', value: days }
  return { kind: 'absolute', at }
}

/** 工单短码：与 Host 的 shortTicketId 同规则。 */
export function shortTicket(ticketId: string): string {
  return ticketId.replace(/^t-/, '').slice(0, 6)
}

/** 返回尚未填写的必填字段；空字符串视为未填。 */
export function missingRequiredFields(
  approval: ApprovalView,
  values: Readonly<Record<string, string | boolean>>,
): ApprovalField[] {
  return approval.fields.filter(field => {
    if (field.required !== true) return false
    const value = values[field.key]
    if (value === undefined) return true
    return typeof value === 'string' ? value.trim().length === 0 : false
  })
}

export interface ApprovalDraft {
  optionIndex?: number
  note: string
  fields: Readonly<Record<string, string | boolean>>
}

/** 构造提交体；缺少必填字段、未选项或数字非法时返回 undefined。 */
export function buildDecision(approval: ApprovalView, draft: ApprovalDraft): DecisionRequest | undefined {
  if (missingRequiredFields(approval, draft.fields).length > 0) return undefined

  const fields: Record<string, string | number | boolean> = {}
  for (const field of approval.fields) {
    const raw = draft.fields[field.key]
    if (raw === undefined) continue
    if (field.type === 'boolean') {
      fields[field.key] = raw === true
      continue
    }
    const text = String(raw).trim()
    if (text.length === 0) continue
    if (field.type === 'number') {
      const numeric = Number(text)
      if (!Number.isFinite(numeric)) return undefined
      fields[field.key] = numeric
      continue
    }
    fields[field.key] = text
  }

  const note = draft.note.trim()
  const extras = {
    ...(note.length === 0 ? {} : { note }),
    ...(Object.keys(fields).length === 0 ? {} : { fields }),
  }
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
