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
