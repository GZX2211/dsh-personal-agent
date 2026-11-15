// src/host/approvals/message.ts
//
// 投递给 worker 的审批结果消息（方案 §6.5）。它必须自解释：原工具调用已经结束，
// 若期间进程重启，其结果对模型来说是「未知」，这条消息是唯一的续接说明。

import type { ApprovalDecision, ApprovalView } from '../../shared/approvals.ts'

export function formatApprovalDelivery(approval: ApprovalView, decision: ApprovalDecision): string {
  const lines = [
    `[审批结果] 审批 ${approval.id}（工单 ${approval.ticketId}）已有决定。`,
    '',
    decisionLine(approval, decision),
  ]

  if (decision.note !== undefined && decision.note.trim().length > 0) {
    lines.push('', `补充说明：${decision.note.trim()}`)
  }

  const fields = formatFields(approval, decision)
  if (fields.length > 0) lines.push('', '填写字段：', ...fields)

  lines.push(
    '',
    '提醒：你先前提交该审批的工具调用已结束（若期间进程重启，其结果为「未知」）。',
    '请据此继续；若该决定不足以继续，请再次提交审批。',
  )
  return lines.join('\n')
}

function decisionLine(approval: ApprovalView, decision: ApprovalDecision): string {
  if (decision.kind === 'skipped') {
    return '决定：跳过（由你自行决定或放弃该动作）'
  }
  const label = decision.label ?? approval.options[decision.index ?? -1]?.label ?? ''
  return `决定：${label}（option ${decision.index ?? 0}）`
}

function formatFields(approval: ApprovalView, decision: ApprovalDecision): string[] {
  const values = decision.fields
  if (values === undefined) return []
  const labels = new Map(approval.fields.map(field => [field.key, field.label]))
  const ordered = [
    ...approval.fields.map(field => field.key).filter(key => key in values),
    ...Object.keys(values).filter(key => !labels.has(key)),
  ]
  return ordered.map(key => `- ${labels.get(key) ?? key}: ${String(values[key])}`)
}
