// src/host/tools/pa_ledger_query/index.ts
//
// router 的只读账本查询：返回紧凑文本而不是 JSON 大对象，方便模型直接回答
// 「做到哪了」。它没有任何副作用，也不触发调度。

import type { ToolDefinition } from '@deepseek-ai/dsh-tools'
import type { ApprovalView } from '../../../shared/approvals.ts'
import type { TicketStage, TicketView } from '../../../shared/tickets.ts'
import type { Projection } from '../../projector/project.ts'
import type { EventStore } from '../../store/event-store.ts'
import { shortTicketId } from '../../tickets/ids.ts'

export const LEDGER_QUERY_TOOL_NAME = 'pa_ledger_query'

export interface LedgerQueryDependencies {
  store: EventStore
}

export type LedgerScope = 'tickets' | 'approvals' | 'both'
export type LedgerFilter = 'active' | 'ended' | 'all'

export interface LedgerQueryArgs {
  scope: LedgerScope
  filter: LedgerFilter
  limit: number
}

const DEFAULT_LIMIT = 10
const MAX_LIMIT = 50

export function parseLedgerQueryArgs(raw: unknown): LedgerQueryArgs {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error('参数必须是一个对象')
  }
  const record = raw as Record<string, unknown>
  const scope = record.scope
  if (scope !== 'tickets' && scope !== 'approvals' && scope !== 'both') {
    throw new Error('scope 必须是 tickets、approvals 或 both')
  }
  const filter = record.filter
  if (filter !== 'active' && filter !== 'ended' && filter !== 'all') {
    throw new Error('filter 必须是 active、ended 或 all')
  }
  let limit = DEFAULT_LIMIT
  if (record.limit !== undefined) {
    if (typeof record.limit !== 'number' || !Number.isFinite(record.limit)) {
      throw new Error('limit 必须是数字')
    }
    limit = Math.min(MAX_LIMIT, Math.max(1, Math.floor(record.limit)))
  }
  return { scope, filter, limit }
}

/** 把投影压成一段紧凑文本；超出 limit 时明确标注被省略。 */
export function formatLedgerQuery(projection: Projection, args: LedgerQueryArgs): string {
  const lines: string[] = []

  if (args.scope === 'tickets' || args.scope === 'both') {
    const tickets = filterTickets(projection.tickets, args.filter)
    lines.push(`工单（${tickets.length}）`)
    for (const ticket of tickets.slice(0, args.limit)) lines.push(`- ${ticketLine(ticket)}`)
    if (tickets.length > args.limit) lines.push(`…… 另有 ${tickets.length - args.limit} 单未显示`)
  }

  if (args.scope === 'approvals' || args.scope === 'both') {
    const approvals = filterApprovals(projection.approvals, args.filter)
    lines.push(`审批（${approvals.length}）`)
    for (const approval of approvals.slice(0, args.limit)) lines.push(`- ${approvalLine(approval)}`)
    if (approvals.length > args.limit) lines.push(`…… 另有 ${approvals.length - args.limit} 条未显示`)
  }

  return lines.join('\n')
}

export function createLedgerQueryTool(deps: LedgerQueryDependencies): ToolDefinition {
  return {
    name: LEDGER_QUERY_TOOL_NAME,
    description: '只读查询工单与审批进度，返回紧凑文本。没有副作用，不会触发调度。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['scope', 'filter'],
      properties: {
        scope: {
          type: 'string',
          enum: ['tickets', 'approvals', 'both'],
          description: '查询范围。',
        },
        filter: {
          type: 'string',
          enum: ['active', 'ended', 'all'],
          description: 'active：未结束/待审批；ended：已结束/已通过；all：全部。',
        },
        limit: { type: 'number', minimum: 1, maximum: MAX_LIMIT, description: '每种范围最多返回多少条，默认 10。' },
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['text'],
        properties: { text: { type: 'string' } },
      },
      render: (_args: unknown, value: unknown) => [
        { type: 'text', text: (value as { text: string }).text },
      ],
    },
    execute: async (rawArgs: unknown) => {
      const args = parseLedgerQueryArgs(rawArgs)
      return { text: formatLedgerQuery(deps.store.projection(), args) }
    },
  }
}

function filterTickets(tickets: readonly TicketView[], filter: LedgerFilter): TicketView[] {
  if (filter === 'all') return [...tickets]
  const ended = filter === 'ended'
  return tickets.filter(ticket => (ticket.stage === 'ended') === ended)
}

function filterApprovals(approvals: readonly ApprovalView[], filter: LedgerFilter): ApprovalView[] {
  if (filter === 'all') return [...approvals]
  const ended = filter === 'ended'
  return approvals.filter(approval => (approval.decidedAt !== undefined) === ended)
}

function ticketLine(ticket: TicketView): string {
  const parts = [`#${shortTicketId(ticket.id)}`, stageLabel(ticket.stage)]
  if (ticket.interrupted) parts.push('已中断')
  if (ticket.queueReason !== undefined) parts.push(queueLabel(ticket.queueReason))
  parts.push(ticket.title, `目标：${ticket.goal}`)
  if (ticket.report !== undefined) parts.push(`汇报：${ticket.report}`)
  return parts.join(' · ')
}

function approvalLine(approval: ApprovalView): string {
  const state = approval.decidedAt === undefined ? '待审批' : '已通过'
  const decision =
    approval.decision === undefined
      ? ''
      : approval.decision.kind === 'skipped'
        ? '（跳过）'
        : approval.decision.kind === 'answered'
          ? `（回答：${approval.decision.answer ?? ''}）`
          : `（${approval.decision.label ?? ''}）`
  const scope =
    approval.ticketId === undefined
      ? '（独立审批）'
      : `（工单 #${shortTicketId(approval.ticketId)}）`
  return `#${approval.id} ${state}${decision} ${questionPreview(approval.question)}${scope}`
}

/** 题干可能很长：查询结果只给第一行、最多 24 字，够认出是哪一条。 */
function questionPreview(question: string): string {
  const line = question.split('\n')[0]?.trim() ?? ''
  const characters = [...line]
  return characters.length > 24 ? `${characters.slice(0, 24).join('')}…` : line
}

function stageLabel(stage: TicketStage): string {
  switch (stage) {
    case 'queued':
      return '待处理'
    case 'running':
      return '进行中'
    case 'blocked':
      return '进行中（阻塞中）'
    case 'ended':
      return '已结束'
  }
}

function queueLabel(reason: 'worker-busy' | 'capacity-full'): string {
  return reason === 'worker-busy' ? '排队：执行会话忙' : '排队：名额已满'
}
