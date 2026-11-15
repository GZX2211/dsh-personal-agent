// tests/client/lib/tickets.test.ts
//
// 工单页的纯展示逻辑：胶囊归属（blocked 算进行中）与副标签（阻塞中 / 已中断）。

import { describe, expect, it } from 'vitest'
import type { TicketView } from '../../../src/shared/tickets.ts'
import {
  matchesTicketCapsule,
  outcomeKey,
  queueReasonKey,
  stageKey,
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

describe('ticketTags', () => {
  it('reports the 阻塞中副标签 only for a blocked ticket', () => {
    expect(ticketTags(ticket({ stage: 'blocked' }))).toEqual(['blocked'])
    expect(ticketTags(ticket({ stage: 'running' }))).toEqual([])
  })

  it('reports the 已中断副标签 for an interrupted running ticket', () => {
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
