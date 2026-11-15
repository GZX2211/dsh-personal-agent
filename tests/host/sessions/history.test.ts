// tests/host/sessions/history.test.ts
//
// 汇报摘要来自会话日志，而不是模型额外调用：取最后一条完整 assistant 文本。

import type { SessionEvent } from '@deepseek-ai/dsh-session'
import { describe, expect, it } from 'vitest'
import { SUMMARY_MAX_CHARS, summarizeAssistantReply } from '../../../src/host/sessions/history.ts'

function assistantMessage(
  content: { type: string; text?: string }[],
  options: { interrupted?: boolean } = {},
): SessionEvent {
  return {
    type: 'assistant/message',
    seq: 1,
    time: 0,
    data: {
      turn: 1,
      step: 1,
      ...(options.interrupted === true ? { interrupted: true } : {}),
      message: { id: 'm-1', role: 'assistant', content, source: { kind: 'model' } },
      stream: [],
    },
  } as unknown as SessionEvent
}

describe('summarizeAssistantReply', () => {
  it('returns the last assistant text', () => {
    const events = [assistantMessage([{ type: 'text', text: '第一版' }]), assistantMessage([{ type: 'text', text: '第二版' }])]

    expect(summarizeAssistantReply(events)).toBe('第二版')
  })

  it('ignores interrupted assistant output', () => {
    const events = [
      assistantMessage([{ type: 'text', text: '完整汇报' }]),
      assistantMessage([{ type: 'text', text: '半截输' }], { interrupted: true }),
    ]

    expect(summarizeAssistantReply(events)).toBe('完整汇报')
  })

  it('joins multiple text blocks', () => {
    const events = [assistantMessage([{ type: 'text', text: '第一段' }, { type: 'text', text: '第二段' }])]

    expect(summarizeAssistantReply(events)).toBe('第一段\n第二段')
  })

  it('skips empty text and returns undefined when nothing remains', () => {
    const events = [assistantMessage([]), assistantMessage([{ type: 'text', text: '   ' }])]

    expect(summarizeAssistantReply(events)).toBeUndefined()
  })

  it('truncates a long report with an ellipsis', () => {
    const long = '很长的汇报'.repeat(100)

    const summary = summarizeAssistantReply([assistantMessage([{ type: 'text', text: long }])])

    expect(summary).toHaveLength(SUMMARY_MAX_CHARS)
    expect(summary?.endsWith('…')).toBe(true)
  })

  it('returns undefined for a log without assistant messages', () => {
    expect(summarizeAssistantReply([])).toBeUndefined()
  })
})
