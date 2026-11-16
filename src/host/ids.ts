// src/host/ids.ts
//
// 账本主键与关联键生成。标识是「这条事实叫什么」的约定，与工单/审批的业务语义
// 正交，所以集中在一个文件；真正无副作用的展示短码在 `src/shared/tickets.ts`。

import { randomUUID } from 'node:crypto'

/** 主键前缀之后保留的十六进制位数。 */
const LEDGER_ID_HEX_LENGTH = 10

/** 统一的主键形态：前缀 + 10 位十六进制。 */
function newLedgerId(prefix: 't' | 'a'): string {
  return `${prefix}-${randomUUID().replaceAll('-', '').slice(0, LEDGER_ID_HEX_LENGTH)}`
}

/** 新建工单 id：`t-` + 10 位十六进制。 */
export function createTicketId(): string {
  return newLedgerId('t')
}

/** 新建审批 id：`a-` + 10 位十六进制。 */
export function createApprovalId(): string {
  return newLedgerId('a')
}

/** 审批短码：去掉 `a-` 前缀后的前 6 位，只用于展示。 */
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
