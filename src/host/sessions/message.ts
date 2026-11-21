// src/host/sessions/message.ts
//
// 插件投递的消息：任务简报、审批结果与感知事件都走这里。消息 id 稳定，重复投递
// 同一条；source.kind 声明本插件是生产者，消费端对未知 kind 一律按普通 user 内容处理。

import { createHash } from 'node:crypto'
import type { MessageId, UserMessage } from '@deepseek-ai/dsh-llm'

declare module '@deepseek-ai/dsh-llm' {
  interface MessageSourceMap {
    /**
     * 本插件投递给会话的消息：任务简报、审批结果与补充。
     *
     * `ticketId` / `supplementId` 是业务坐标：消息正文只够读，坐标才让账本之外的
     * 地方（会话日志、详情链）能解释这条消息属于哪张工单。
     */
    'dsh-personal-agent': {
      kind: 'dsh-personal-agent'
      form: 'relay'
      /** 本消息属于哪张工单（简报与补充都带）。 */
      ticketId?: string
      /** 补充消息的幂等键；简报不需要。 */
      supplementId?: string
    }
    /**
     * 本插件投递的感知事件。
     *
     * 来源坐标随消息一起持久化：观察者据此把信号归到来源与线程，不必只靠正文解析。
     */
    'dsh-personal-agent/perception': {
      kind: 'dsh-personal-agent/perception'
      form: 'notice'
      sourceId: string
      threadId: string
      sourceName: string
      threadName: string
    }
  }
}

const DELIVERY_SOURCE_KIND = 'dsh-personal-agent' as const
const PERCEPTION_SOURCE_KIND = 'dsh-personal-agent/perception' as const
const PERCEPTION_ID_PREFIX = 'pa-perception:'

/** 同一 requestId 永远得到同一个消息 id，这是投递幂等的依据。 */
export function deliveryMessageId(requestId: string): MessageId {
  return `pa-delivery:${requestId}` as MessageId
}

/**
 * 感知消息的 id：由来源坐标派生。
 *
 * 不用 signalId 派生：signalId 反而要由消息 id 派生（观察者按 messageId 认信号），
 * 两者互相依赖会绕成环。来源坐标稳定，同一份外部事实重放时仍得到同一条消息。
 */
export function perceptionMessageId(sourceId: string, threadId: string, externalId: string): MessageId {
  const digest = createHash('sha256')
    .update(JSON.stringify([sourceId, threadId, externalId]), 'utf8')
    .digest('hex')
  return `${PERCEPTION_ID_PREFIX}${digest.slice(0, 16)}` as MessageId
}

export interface PerceptionMessageInput {
  sourceId: string
  sourceName: string
  threadId: string
  threadName: string
  /** 来源侧去重键；决定消息身份。 */
  externalId: string
  /** 事实陈述（已渲染模板）。 */
  statement: string
  /** 信号的自身 id；正文里带上它，router 可用它在派发时指认这条输入。 */
  signalId: string
  at: number
}

/**
 * 构造感知消息。
 *
 * 正文只陈述事实，不带任何行动指令：要不要行动是 router 的判断，不是来源的判断。
 */
export function createPerceptionMessage(input: PerceptionMessageInput): UserMessage {
  const text = [
    '[感知事件]',
    `来源：${input.sourceName} · ${input.threadName}`,
    `时间：${formatLocalTime(input.at)}`,
    `事实：${input.statement}`,
    `信号：${input.signalId}`,
  ].join('\n')

  const message: UserMessage = {
    id: perceptionMessageId(input.sourceId, input.threadId, input.externalId),
    role: 'user',
    content: [{ type: 'text', text }],
    source: {
      kind: PERCEPTION_SOURCE_KIND,
      form: 'notice',
      sourceId: input.sourceId,
      threadId: input.threadId,
      sourceName: input.sourceName,
      threadName: input.threadName,
    },
  }
  return deepFreeze(structuredClone(message))
}

/** 本地时区的 `YYYY-MM-DD HH:mm:ss`，与总控台其余时间展示一致。 */
function formatLocalTime(at: number): string {
  const date = new Date(at)
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

/** 投递消息要带的业务坐标；缺省时 source 只有生产者声明。 */
export interface DeliveryMessageMeta {
  ticketId?: string
  supplementId?: string
}

/**
 * 构造投递消息。
 *
 * 消息在 IPC 与模型边界之间会被反复传递，必须已经不可变；这里自行深冻结而不是
 * 引入 `@deepseek-ai/dsh-llm` 的运行时值，插件对它只保留类型依赖。
 */
export function createDeliveryMessage(
  requestId: string,
  text: string,
  meta: DeliveryMessageMeta = {},
): UserMessage {
  const message: UserMessage = {
    id: deliveryMessageId(requestId),
    role: 'user',
    content: [{ type: 'text', text }],
    source: {
      kind: DELIVERY_SOURCE_KIND,
      form: 'relay',
      ...(meta.ticketId === undefined ? {} : { ticketId: meta.ticketId }),
      ...(meta.supplementId === undefined ? {} : { supplementId: meta.supplementId }),
    },
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
