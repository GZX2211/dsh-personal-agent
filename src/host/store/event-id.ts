// src/host/store/event-id.ts
//
// eventId 派生（方案 §3.2）：sha256(type + correlationId + 规范化关键字段 +
// causationId) 取前 32 位。它是账本的幂等键，所以参与派生的字段必须只包含
// 「这条事实是什么」，不包含「这条事实怎么展示」。

import { createHash } from 'node:crypto'
import type { EventDraft, EventType } from '../../shared/events.ts'

/**
 * 各类事件的身份字段。
 *
 * 只列关键字段：标题、目标、选项文案这类展示字段一旦参与，改一个错别字就会让
 * 同一条事实重复入账。整张表是显式契约，新增事件类型时必须在此登记。
 *
 * `task/reported.summary` 是关键字段的例外：它是汇报文本本身，同一段汇报重复
 * 入账应当被幂等掉，而不是当成一次新汇报。
 *
 * 信号只按 `signalId` 定身份，不掺入到达时间、文本等观测细节：同一条消息被再次
 * 观察时这些细节都会变，掺进去幂等就失效了。决定同理——一条决定属于一条信号。
 */
const KEY_FIELDS: Record<EventType, readonly string[]> = {
  'signal/received': ['signalId'],
  'decision/recorded': ['signalId'],
  'task/queued': ['ticketId'],
  'task/dispatched': ['ticketId'],
  'task/interrupted': ['ticketId', 'turn', 'reason'],
  'task/resumed': ['ticketId', 'turn'],
  'task/reported': ['ticketId', 'status', 'summary'],
  'task/closed': ['ticketId'],
  'approval/pending': ['approvalId'],
  'approval/decided': ['approvalId'],
  'approval/discarded': ['approvalId'],
}

/** 同一条事实永远得到同一个 id。 */
export function deriveEventId(draft: EventDraft): string {
  // 各 payload 是结构化类型而非索引签名；按名字取字段只能经过一次显式转换。
  const payload = draft.payload as unknown as Record<string, unknown>
  // JSON 数组保证键序固定；缺失字段与显式 undefined 都序列化为 null。
  const canonical = JSON.stringify([
    draft.type,
    draft.correlationId,
    draft.causationId ?? null,
    KEY_FIELDS[draft.type].map(name => [name, payload[name]]),
  ])
  return createHash('sha256').update(canonical, 'utf8').digest('hex').slice(0, 32)
}
