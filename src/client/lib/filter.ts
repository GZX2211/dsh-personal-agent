// src/client/lib/filter.ts
//
// 审批页与工单页共用的搜索与胶囊过滤（方案 §10.5）。纯函数：输入即全部事实，
// 不读环境；语言与词典由调用方一起传进来。
//
// haystack 覆盖卡片上看得见的字段（题干、选项、附件、决定、工单信息、目录与
// 时间文本），小写化后按空白分词做 AND 子串匹配；空查询不过滤。搜索与胶囊是
// 交集关系。

import type { ApprovalView } from '../../shared/approvals.ts'
import type { TicketView } from '../../shared/tickets.ts'
import { shortTicketId } from '../../shared/tickets.ts'
import type { Translate } from '../i18n.ts'
import { formatTimestamp, riskKey } from './format.ts'
import {
  matchesTicketCapsule,
  outcomeKey,
  queueReasonKey,
  stageKey,
  tagKey,
  ticketTags,
  type TicketCapsule,
} from './tickets.ts'

/** 构造 haystack 需要的展示上下文：语言决定时间文本。 */
export interface FilterContext {
  t: Translate
  language: string
}

export type ApprovalCapsule = 'pending' | 'decided' | 'all'

/** 按空白分词并小写；空查询得到空数组（不过滤）。 */
export function tokenizeQuery(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(token => token.length > 0)
}

/** 每个关键词都必须命中。 */
export function matchesQuery(haystack: string, tokens: readonly string[]): boolean {
  return tokens.every(token => haystack.includes(token))
}

/** 展平业务字段并小写化，作为一次匹配的 haystack。 */
export function buildHaystack(values: readonly unknown[]): string {
  const parts: string[] = []
  collect(values, parts)
  return parts.join(' ').toLowerCase()
}

function collect(value: unknown, out: string[]): void {
  if (value === undefined || value === null) return
  if (Array.isArray(value)) {
    for (const item of value) collect(item, out)
    return
  }
  if (typeof value === 'string') {
    if (value.length > 0) out.push(value)
    return
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    out.push(String(value))
    return
  }
  if (typeof value === 'object') {
    for (const item of Object.values(value)) collect(item, out)
  }
}

/** 时间字段的可搜形态：时间戳、ISO 与界面上看到的绝对时间。 */
function pushTime(out: unknown[], ctx: FilterContext, at: number | undefined): void {
  if (at === undefined) return
  out.push(at, new Date(at).toISOString(), formatTimestamp(ctx.language, at))
}

export function approvalHaystack(approval: ApprovalView, ctx: FilterContext): string {
  const parts: unknown[] = [
    approval.question,
    approval.options,
    approval.attachments,
    approval.id,
    approval.requestedBySessionId,
  ]
  if (approval.ticketId !== undefined) {
    parts.push(approval.ticketId, shortTicketId(approval.ticketId))
  }
  if (approval.risk !== undefined) parts.push(ctx.t(riskKey(approval.risk)))
  if (approval.decision !== undefined) {
    parts.push(approval.decision.label, approval.decision.answer, approval.decision.transport)
  }
  pushTime(parts, ctx, approval.createdAt)
  pushTime(parts, ctx, approval.decidedAt)
  return buildHaystack(parts)
}

export function ticketHaystack(ticket: TicketView, ctx: FilterContext): string {
  const parts: unknown[] = [
    ticket.title,
    ticket.goal,
    ticket.context,
    ticket.constraints,
    ticket.expectedOutput,
    ticket.report,
    ticket.directory,
    ticket.id,
    ticket.shortId,
    ticket.workerSessionId,
    ctx.t(stageKey(ticket.stage)),
  ]
  if (ticket.queueReason !== undefined) parts.push(ctx.t(queueReasonKey(ticket.queueReason)))
  for (const tag of ticketTags(ticket)) parts.push(ctx.t(tagKey(tag)))
  if (ticket.outcome !== undefined) parts.push(ctx.t(outcomeKey(ticket.outcome)))
  pushTime(parts, ctx, ticket.createdAt)
  pushTime(parts, ctx, ticket.updatedAt)
  pushTime(parts, ctx, ticket.endedAt)
  return buildHaystack(parts)
}

export function matchesApprovalCapsule(approval: ApprovalView, capsule: ApprovalCapsule): boolean {
  switch (capsule) {
    case 'pending':
      return approval.decidedAt === undefined
    case 'decided':
      return approval.decidedAt !== undefined
    case 'all':
      return true
  }
}

export function filterApprovals(
  approvals: readonly ApprovalView[],
  capsule: ApprovalCapsule,
  query: string,
  ctx: FilterContext,
): ApprovalView[] {
  const tokens = tokenizeQuery(query)
  return approvals.filter(
    approval => matchesApprovalCapsule(approval, capsule) && matchesQuery(approvalHaystack(approval, ctx), tokens),
  )
}

export function filterTickets(
  tickets: readonly TicketView[],
  capsule: TicketCapsule,
  query: string,
  ctx: FilterContext,
): TicketView[] {
  const tokens = tokenizeQuery(query)
  return tickets.filter(
    ticket => matchesTicketCapsule(ticket, capsule) && matchesQuery(ticketHaystack(ticket, ctx), tokens),
  )
}
