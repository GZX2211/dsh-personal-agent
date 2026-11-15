// tests/client/lib/tickets.test.ts
//
// 工单页的纯展示逻辑：胶囊归属（blocked 算进行中）与头部徽标
// （一个状态徽标，阻塞中与已中断优先显示）。

import { describe, expect, it } from 'vitest'
import type { TicketView } from '../../../src/shared/tickets.ts'
import {
  matchesTicketCapsule,
  outcomeKey,
  queueReasonKey,
  stageKey,
  ticketBadge,
  ticketTags,
} from '../../../src/client/lib/tickets.ts'

const NOW = 1_700_000_000_000

function ticket(overrides: Partial<TicketView> = {}): TicketView {
  return {
    id: 't-9c20e78bca',
    shortId: '9c20e7',
    title: '建文件',
    stage: 'running',
    goal: '在 D:\\tmp 下创建 hello.txt',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

describe('matchesTicketCapsule', () => {
  it('groups blocked under running and keeps the other stages apart', () => {
    expect(matchesTicketCapsule(ticket({ stage: 'queued' }), 'queued')).toBe(true)
    expect(matchesTicketCapsule(ticket({ stage: 'queued' }), 'running')).toBe(false)
    expect(matchesTicketCapsule(ticket({ stage: 'running' }), 'running')).toBe(true)
    expect(matchesTicketCapsule(ticket({ stage: 'blocked' }), 'running')).toBe(true)
    expect(matchesTicketCapsule(ticket({ stage: 'ended' }), 'ended')).toBe(true)
    expect(matchesTicketCapsule(ticket({ stage: 'ended' }), 'running')).toBe(false)
  })

  it('keeps every stage in the all capsule', () => {
    for (const stage of ['queued', 'running', 'blocked', 'ended'] as const) {
      expect(matchesTicketCapsule(ticket({ stage }), 'all')).toBe(true)
    }
  })
})

describe('ticketBadge', () => {
  it('shows the stage a queued or running ticket is in', () => {
    expect(ticketBadge(ticket({ stage: 'queued' }))).toEqual({ labelKey: 'ticketStageQueued', tone: 'idle' })
    expect(ticketBadge(ticket({ stage: 'running' }))).toEqual({ labelKey: 'ticketStageRunning', tone: 'business' })
  })

  it('prefers blocked over everything else', () => {
    expect(ticketBadge(ticket({ stage: 'blocked', interrupted: true }))).toEqual({
      labelKey: 'ticketTagBlocked',
      tone: 'warn',
    })
  })

  it('prefers interrupted over the plain running badge', () => {
    expect(ticketBadge(ticket({ stage: 'running', interrupted: true }))).toEqual({
      labelKey: 'ticketTagInterrupted',
      tone: 'error',
    })
  })

  it('tones an ended ticket by its outcome', () => {
    expect(ticketBadge(ticket({ stage: 'ended', outcome: 'completed' }))).toEqual({
      labelKey: 'ticketStageEnded',
      tone: 'success',
    })
    expect(ticketBadge(ticket({ stage: 'ended', outcome: 'failed' }))).toEqual({
      labelKey: 'ticketStageEnded',
      tone: 'error',
    })
  })
})

describe('ticketTags', () => {
  it('reports the blocked tag only for a blocked ticket', () => {
    expect(ticketTags(ticket({ stage: 'blocked' }))).toEqual(['blocked'])
    expect(ticketTags(ticket({ stage: 'running' }))).toEqual([])
  })

  it('reports the interrupted tag for an interrupted running ticket', () => {
    expect(ticketTags(ticket({ stage: 'running', interrupted: true }))).toEqual(['interrupted'])
    expect(ticketTags(ticket({ stage: 'ended', interrupted: true }))).toEqual([])
  })
})

describe('label keys', () => {
  it('maps stages, queue reasons and outcomes to dictionary keys', () => {
    expect(stageKey('blocked')).toBe('ticketStageBlocked')
    expect(queueReasonKey('capacity-full')).toBe('ticketQueueCapacityFull')
    expect(outcomeKey('failed')).toBe('ticketOutcomeFailed')
  })
})
