// src/host/sessions/message.ts
//
// 插件投递的消息：一条带稳定 id 的 user 消息，id 由 requestId 派生，重复投递同
// 一条。source.kind 声明本插件是生产者，消费端对未知 kind 一律按普通 user 内容处理。

import type { MessageId, UserMessage } from '@deepseek-ai/dsh-llm'

declare module '@deepseek-ai/dsh-llm' {
  interface MessageSourceMap {
    /** 本插件投递给会话的消息：任务简报与审批结果。 */
    'dsh-personal-agent': { kind: 'dsh-personal-agent'; form: 'relay' }
  }
}

export const DELIVERY_SOURCE_KIND = 'dsh-personal-agent' as const

/** 同一 requestId 永远得到同一个消息 id，这是投递幂等的依据。 */
export function deliveryMessageId(requestId: string): MessageId {
  return `pa-delivery:${requestId}` as MessageId
}

/**
 * 构造投递消息。
 *
 * 消息在 IPC 与模型边界之间会被反复传递，必须已经不可变；这里自行深冻结而不是
 * 引入 `@deepseek-ai/dsh-llm` 的运行时值，插件对它只保留类型依赖。
 */
export function createDeliveryMessage(requestId: string, text: string): UserMessage {
  const message: UserMessage = {
    id: deliveryMessageId(requestId),
    role: 'user',
    content: [{ type: 'text', text }],
    source: { kind: DELIVERY_SOURCE_KIND, form: 'relay' },
  }
  return deepFreeze(structuredClone(message))
}

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    for (const child of Object.values(value)) deepFreeze(child)
    Object.freeze(value)
  }
  return value
}
