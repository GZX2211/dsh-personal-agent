// tests/client/lib/tickets.test.ts
//
// 工单卡片的纯展示逻辑：阶段/排队原因/结果到词典键，以及一句话预览与短会话名。

import { describe, expect, it } from 'vitest'
import type { TicketView } from '../../../src/shared/tickets.ts'
import {
  outcomeKey,
  queueReasonKey,
  shortSession,
  stageBadgeKey,
  stageKey,
  ticketPreview,
} from '../../../src/client/lib/tickets.ts'

function ticket(overrides: Partial<TicketView> = {}): TicketView {
  return {
    id: 't-9c20e78bca',
    shortId: '9c20e7',
    title: '建文件',
    stage: 'running',
    goal: '在 D:\\tmp 下创建 hello.txt',
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_100_000,
    ...overrides,
  }
}

describe('stageKey', () => {
  it('maps every derived stage to its dictionary key', () => {
    expect(stageKey('queued')).toBe('ticketStageQueued')
    expect(stageKey('running')).toBe('ticketStageRunning')
    expect(stageKey('blocked')).toBe('ticketStageBlocked')
    expect(stageKey('ended')).toBe('ticketStageEnded')
  })
})

describe('stageBadgeKey', () => {
  it('shows a blocked ticket under the running badge', () => {
    expect(stageBadgeKey('blocked')).toBe('ticketStageRunning')
    expect(stageBadgeKey('running')).toBe('ticketStageRunning')
    expect(stageBadgeKey('queued')).toBe('ticketStageQueued')
    expect(stageBadgeKey('ended')).toBe('ticketStageEnded')
  })
})

describe('queueReasonKey', () => {
  it('maps both queue reasons', () => {
    expect(queueReasonKey('worker-busy')).toBe('ticketQueueBusy')
    expect(queueReasonKey('capacity-full')).toBe('ticketQueueCapacityFull')
  })
})

describe('outcomeKey', () => {
  it('maps both outcomes', () => {
    expect(outcomeKey('completed')).toBe('ticketOutcomeCompleted')
    expect(outcomeKey('failed')).toBe('ticketOutcomeFailed')
  })
})

describe('ticketPreview', () => {
  it('prefers the report of an ended ticket over the goal', () => {
    expect(ticketPreview(ticket({ stage: 'ended', report: '已完成并验证' }))).toBe('已完成并验证')
  })

  it('falls back to the goal without a report', () => {
    expect(ticketPreview(ticket())).toBe('在 D:\\tmp 下创建 hello.txt')
    expect(ticketPreview(ticket({ stage: 'ended', report: '   ' }))).toBe('在 D:\\tmp 下创建 hello.txt')
  })

  it('flattens line breaks and trims the text', () => {
    expect(ticketPreview(ticket({ goal: '第一行\n\n  第二行  ' }))).toBe('第一行 第二行')
  })

  it('truncates long text with an ellipsis', () => {
    const long = 'x'.repeat(200)
    const preview = ticketPreview(ticket({ goal: long }))

    expect(preview).toBe(`${'x'.repeat(120)}…`)
    expect(preview.length).toBe(121)
  })

  it('keeps text at the limit untouched', () => {
    const exact = 'y'.repeat(120)
    expect(ticketPreview(ticket({ goal: exact }))).toBe(exact)
  })
})

describe('shortSession', () => {
  it('drops the session prefix and keeps eight characters', () => {
    expect(shortSession('session-19b0e213-c843-4e91-98da-2ed6c474dc59')).toBe('19b0e213')
  })

  it('returns the input when it carries no prefix', () => {
    expect(shortSession('worker-1')).toBe('worker-1')
  })
})
