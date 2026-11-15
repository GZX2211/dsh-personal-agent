// src/client/lib/filter.ts
//
// 审批页与工单页共用的搜索与胶囊过滤（方案 §10.5）。纯函数：输入即全部事实，
// 不读环境；时间文案由调用方把 `t` / `language` / `now` 一起传进来。
//
// haystack 覆盖全部业务字段（标题、正文、选项、约束、汇报、id、短码、目录、
// 会话、排队原因、阶段与结果，以及绝对时间与相对时间文本），小写化后按空白
// 分词做 AND 子串匹配；空查询不过滤。搜索与胶囊是交集关系。

import type { ApprovalView } from '../../shared/approvals.ts'
import type { TicketView } from '../../shared/tickets.ts'
import type { Translate } from '../i18n.ts'
import { shortTicket } from './approvals.ts'
import { formatTime, riskKey } from './format.ts'
import { outcomeKey, queueReasonKey, stageKey } from './tickets.ts'

/** 构造 haystack 需要的展示上下文：语言决定时间文本，`now` 决定相对时间。 */
export interface FilterContext {
  t: Translate
  language: string
  now: number
}

export type ApprovalCapsule = 'pending' | 'decided' | 'all'
export type TicketCapsule = 'queued' | 'running' | 'ended' | 'all'

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

/** 时间字段的三种可搜形态：时间戳、ISO、本地化绝对时间与相对时间。 */
function pushTime(out: unknown[], ctx: FilterContext, at: number | undefined): void {
  if (at === undefined) return
  out.push(
    at,
    new Date(at).toISOString(),
    new Date(at).toLocaleString(ctx.language),
    formatTime(ctx.t, ctx.language, ctx.now, at),
  )
}

export function approvalHaystack(approval: ApprovalView, ctx: FilterContext): string {
  const parts: unknown[] = [
    approval.title,
    approval.question,
    approval.id,
    approval.ticketId,
    shortTicket(approval.ticketId),
    approval.requestedBySessionId,
    approval.options,
    approval.fields,
  ]
  if (approval.risk !== undefined) parts.push(ctx.t(riskKey(approval.risk)))
  if (approval.decision !== undefined) {
    parts.push(approval.decision.label, approval.decision.note, approval.decision.transport, approval.decision.fields)
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
  if (ticket.interrupted === true) parts.push(ctx.t('ticketInterruptedTag'))
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

/** `blocked` 是进行中的副标签，不是独立胶囊（方案 §5.1）。 */
export function matchesTicketCapsule(ticket: TicketView, capsule: TicketCapsule): boolean {
  switch (capsule) {
    case 'queued':
      return ticket.stage === 'queued'
    case 'running':
      return ticket.stage === 'running' || ticket.stage === 'blocked'
    case 'ended':
      return ticket.stage === 'ended'
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
