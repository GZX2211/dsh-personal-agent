// src/client/lib/tickets.ts
//
// 工单页的纯展示逻辑：胶囊归属、副标签与词典键映射。不读环境。

import type { QueueReason, TicketOutcome, TicketStage, TicketView } from '../../shared/tickets.ts'
import type { Dict } from '../i18n.ts'

/** 工单页胶囊；`blocked` 归入进行中，不单独成胶囊（方案 §5.1）。 */
export type TicketCapsule = 'queued' | 'running' | 'ended' | 'all'

/** 工单卡片上的副标签；只有这两种，状态重复的信息不再做徽标。 */
export type TicketTag = 'blocked' | 'interrupted'

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

const TAG_KEYS: Record<TicketTag, keyof Dict> = {
  blocked: 'ticketTagBlocked',
  interrupted: 'ticketTagInterrupted',
}

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

/** 副标签：阻塞中只属于 blocked，已中断只属于「进行中且回合被中断」。 */
export function ticketTags(ticket: TicketView): TicketTag[] {
  const tags: TicketTag[] = []
  if (ticket.stage === 'blocked') tags.push('blocked')
  if (ticket.stage === 'running' && ticket.interrupted === true) tags.push('interrupted')
  return tags
}

export function tagKey(tag: TicketTag): keyof Dict {
  return TAG_KEYS[tag]
}

export function stageKey(stage: TicketStage): keyof Dict {
  return STAGE_KEYS[stage]
}

export function queueReasonKey(reason: QueueReason): keyof Dict {
  return QUEUE_KEYS[reason]
}

export function outcomeKey(outcome: TicketOutcome): keyof Dict {
  return OUTCOME_KEYS[outcome]
}
