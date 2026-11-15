// src/host/sessions/history.ts
//
// 从会话日志里读出「这一回合最后说了什么」。它是汇报摘要的唯一来源：
// worker 不需要额外工具，回合结束的事实本身就带回了结论。

import type { SessionEvent } from '@deepseek-ai/dsh-session'

/** 汇报摘要上限：卡片上只留一句话的长度。 */
export const SUMMARY_MAX_CHARS = 200

/**
 * 最后一条非中断的 assistant 文本。
 *
 * 被中断的 assistant 消息只是半截输出，不能当汇报；完全没有文本时返回 undefined，
 * 由调用方决定「不写汇报」而不是编造一句。
 */
export function summarizeAssistantReply(events: readonly SessionEvent[]): string | undefined {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]
    if (event === undefined || event.type !== 'assistant/message') continue
    if (event.data.interrupted === true) continue
    const text = event.data.message.content
      .filter(block => block.type === 'text')
      .map(block => (block as { text: string }).text)
      .join('\n')
      .trim()
    if (text.length === 0) continue
    return text.length <= SUMMARY_MAX_CHARS ? text : `${text.slice(0, SUMMARY_MAX_CHARS - 1)}…`
  }
  return undefined
}
