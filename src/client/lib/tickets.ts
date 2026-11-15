// src/client/lib/tickets.ts
//
// 工单卡片的纯展示逻辑：阶段/排队原因/结果到词典键，一句话预览与短会话名。
// 不读环境；文案查找由调用方的翻译函数完成。

import type { QueueReason, TicketOutcome, TicketStage, TicketView } from '../../shared/tickets.ts'
import type { Dict } from '../i18n.ts'

const STAGE_KEYS: Record<TicketStage, keyof Dict> = {
  queued: 'ticketStageQueued',
  running: 'ticketStageRunning',
  blocked: 'ticketStageBlocked',
  ended: 'ticketStageEnded',
}

const QUEUE_KEYS: Record<QueueReason, keyof Dict> = {
  'worker-busy': 'ticketQueueBusy',
  'capacity-full': 'ticketQueueCapacityFull',
}

const OUTCOME_KEYS: Record<TicketOutcome, keyof Dict> = {
  completed: 'ticketOutcomeCompleted',
  failed: 'ticketOutcomeFailed',
}

export function stageKey(stage: TicketStage): keyof Dict {
  return STAGE_KEYS[stage]
}

/**
 * 阶段徽标用的键：`blocked` 是进行中的副标签，徽标仍显示「进行中」，
 * 避免同一张卡片上出现两个「阻塞中」（方案 §5.1、§10.4）。
 */
export function stageBadgeKey(stage: TicketStage): keyof Dict {
  return stage === 'blocked' ? 'ticketStageRunning' : STAGE_KEYS[stage]
}

export function queueReasonKey(reason: QueueReason): keyof Dict {
  return QUEUE_KEYS[reason]
}

export function outcomeKey(outcome: TicketOutcome): keyof Dict {
  return OUTCOME_KEYS[outcome]
}

/** 卡片正文上限：一句话，超出截断。 */
export const PREVIEW_LIMIT = 120

/** 卡片的一句话：结束时优先用汇报摘要，否则用目标；压平换行后截断。 */
export function ticketPreview(ticket: TicketView, limit: number = PREVIEW_LIMIT): string {
  const report = ticket.report?.trim() ?? ''
  const source = (report.length > 0 ? report : ticket.goal).replace(/\s+/g, ' ').trim()
  return source.length > limit ? `${source.slice(0, limit)}…` : source
}

/** 会话 id 的展示短名：去掉 `session-` 前缀后取 8 位；没有前缀时原样取前 8 位。 */
export function shortSession(sessionId: string): string {
  const prefix = 'session-'
  const bare = sessionId.startsWith(prefix) ? sessionId.slice(prefix.length) : sessionId
  return bare.slice(0, 8)
}
