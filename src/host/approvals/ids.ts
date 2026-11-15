// src/host/approvals/ids.ts
//
// 审批 id 与工单 id 同一形态：`a-` + 10 位十六进制，短码只用于展示。

import { randomUUID } from 'node:crypto'

export function createApprovalId(): string {
  return `a-${randomUUID().replaceAll('-', '').slice(0, 10)}`
}

export function shortApprovalId(approvalId: string): string {
  return approvalId.replace(/^a-/, '').slice(0, 6)
}

/**
 * 审批事件的串联键：绑定工单时沿用工单，独立审批没有工单，改用审批 id。
 * 同一条审批的 pending 与后续 decided/discarded 必须得到同一个键。
 */
export function approvalCorrelationId(approvalId: string, ticketId: string | undefined): string {
  return ticketId ?? approvalId
}
