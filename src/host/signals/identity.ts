// src/host/signals/identity.ts
//
// signalId 派生：信号的自身身份同时是账本的幂等键与事件的串联键，因此它只能由
// 「这条输入是什么」决定，不能由观察发生的时间或次数决定。

import { createHash } from 'node:crypto'

/** 与账本主键保持同一形态：前缀 + 10 位十六进制。 */
const SIGNAL_ID_PREFIX = 's-'
const SIGNAL_ID_HEX_LENGTH = 10

/**
 * 身份材料按 JSON 数组编码，不用 `:` 拼接。
 *
 * 消息 id 本身就含冒号（`pa-delivery:<requestId>`），拼接会让「会话 A 的消息
 * `x:y`」与「会话 `A:x` 的消息 `y`」落到同一个 id 上。数组编码没有分隔符歧义。
 */
function deriveSignalId(...parts: string[]): string {
  const digest = createHash('sha256').update(JSON.stringify(parts), 'utf8').digest('hex')
  return `${SIGNAL_ID_PREFIX}${digest.slice(0, SIGNAL_ID_HEX_LENGTH)}`
}

/**
 * 已投递信号的身份。
 *
 * 消息 id 只在会话内唯一，所以会话必须参与派生；同时它把 L1 的消息与 L2 的
 * 信号一一对应起来，重放同一条消息不会产生第二条信号。
 */
export function deliveredSignalId(sessionId: string, messageId: string): string {
  return deriveSignalId('m', sessionId, messageId)
}

/**
 * 被过滤信号的身份。
 *
 * 过滤不产生消息，只能靠来源侧的事实坐标（来源 + 线程 + 外部去重键）认人：
 * 同一份外部事实被反复感知时，落到同一条记录上。
 */
export function filteredSignalId(sourceId: string, threadId: string, externalId: string): string {
  return deriveSignalId('f', sourceId, threadId, externalId)
}
