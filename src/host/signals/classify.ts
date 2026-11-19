// src/host/signals/classify.ts
//
// 把一条 inbox 消息归入信号类型，并取出它陈述的事实。
//
// 只认白名单里的三种生产者的 `source.kind`：其余注入（指令、团队消息、目标、
// 背景上下文等）都是 router 的运行环境，不是到达 router 的输入。缺失 source 的
// 消息同样忽略——那类消息无法解释自己从哪里来。

import type { UserMessage } from '@deepseek-ai/dsh-llm'
import type { SignalKind } from '../../shared/events.ts'

/** 进账的正文上限（按 code point 计）：账本要能解释自己，不必存下一整篇文档。 */
const SIGNAL_TEXT_LIMIT = 500

const PERCEPTION_SOURCE_KIND = 'dsh-personal-agent/perception'
const SCHEDULE_HEADER = '[SCHEDULE REMINDER]'
const SCHEDULE_ID_FIELD = 'schedule_id_json:'
const REMINDER_PROMPT_FIELD = 'reminder_prompt_json:'
const FACT_LABEL = '事实：'
const SIGNAL_LABEL = '信号：'

/** 一条消息被识别成的信号事实；身份（signalId）由观察者另行派生。 */
export interface InboxSignal {
  kind: SignalKind
  text: string
  sourceId?: string
  sourceName?: string
  threadId?: string
  threadName?: string
}

/** 感知消息可以从 `source` 上带下来的来源坐标。 */
type SourceField = 'sourceId' | 'sourceName' | 'threadId' | 'threadName'

/** 定时的固定正文：说明行有两种措辞，字段前缀一致。 */
export interface ParsedScheduleReminder {
  scheduleId?: string
  prompt?: string
}

/**
 * 识别一条 inbox 消息；不在白名单内时返回 undefined。
 *
 * 判定只看 `source.kind`，不看正文内容：声明自己是哪种生产者是可信的，而正文
 * 是任意文本，靠它猜来源会把注入的上下文误当成输入。
 */
export function classifyInboxMessage(message: UserMessage): InboxSignal | undefined {
  const source = asRecord(message.source)
  const kind = readString(source?.kind)
  if (kind === 'user') {
    return { kind: 'user-message', text: limitText(readMessageText(message)) }
  }
  if (kind === 'schedule') {
    return classifySchedule(readMessageText(message))
  }
  if (kind === PERCEPTION_SOURCE_KIND) {
    return classifyPerception(source, readMessageText(message))
  }
  return undefined
}

/**
 * 解析定时消息正文。
 *
 * 两个 JSON 字段都按行首前缀取值：`reminder_prompt_json` 的换行在正文里是转义的，
 * 所以一行就是一个完整字段，不需要跨行拼接。
 */
export function parseScheduleReminder(text: string): ParsedScheduleReminder {
  const lines = text.split(/\r?\n/)
  if (lines[0]?.trim() !== SCHEDULE_HEADER) return {}

  const parsed: ParsedScheduleReminder = {}
  for (const line of lines.slice(1)) {
    const trimmed = line.trim()
    if (trimmed.startsWith(SCHEDULE_ID_FIELD)) {
      const value = readJsonString(trimmed.slice(SCHEDULE_ID_FIELD.length))
      if (value !== undefined) parsed.scheduleId = value
    } else if (trimmed.startsWith(REMINDER_PROMPT_FIELD)) {
      const value = readJsonString(trimmed.slice(REMINDER_PROMPT_FIELD.length))
      if (value !== undefined) parsed.prompt = value
    }
  }
  return parsed
}

/**
 * 定时事件的事实是提醒正文；正文不合约定时退化为首行。
 *
 * 降级方向与业务语义一致：宁可给 router 一句不完整的提醒，也不静默丢掉一次定时。
 */
function classifySchedule(text: string): InboxSignal {
  const parsed = parseScheduleReminder(text)
  const fact = parsed.prompt ?? firstLine(text)
  return {
    kind: 'timer',
    text: limitText(fact),
    ...(parsed.scheduleId === undefined ? {} : { sourceId: parsed.scheduleId }),
  }
}

/**
 * 感知消息的事实取正文「事实：」起的若干行，遇到「信号：」行结束。
 *
 * 事实本身可能多行，所以不能只取一行；而「信号：」之后是标识而不是事实。
 * 来源坐标优先取自消息 source（投递时写入），缺失时留空——正文的「来源：」行
 * 只带展示名称，不能替代 id。
 */
function classifyPerception(source: Record<string, unknown> | undefined, text: string): InboxSignal {
  const signal: InboxSignal = { kind: 'perception', text: limitText(readPerceptionFact(text)) }
  assignIfPresent(signal, 'sourceId', readString(source?.sourceId))
  assignIfPresent(signal, 'sourceName', readString(source?.sourceName))
  assignIfPresent(signal, 'threadId', readString(source?.threadId))
  assignIfPresent(signal, 'threadName', readString(source?.threadName))
  return signal
}

function readPerceptionFact(text: string): string {
  const lines = text.split(/\r?\n/)
  const start = lines.findIndex(line => line.startsWith(FACT_LABEL))
  if (start < 0) return firstLine(text)

  const collected: string[] = [(lines[start] ?? '').slice(FACT_LABEL.length)]
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith(SIGNAL_LABEL)) break
    collected.push(line)
  }
  return collected.join('\n')
}

function readMessageText(message: UserMessage): string {
  return message.content.flatMap(block => (block.type === 'text' ? [block.text] : [])).join('\n')
}

function limitText(text: string): string {
  const codePoints = [...text]
  return codePoints.length <= SIGNAL_TEXT_LIMIT ? text : codePoints.slice(0, SIGNAL_TEXT_LIMIT).join('')
}

function firstLine(text: string): string {
  return text.split(/\r?\n/)[0]?.trim() ?? ''
}

function readJsonString(raw: string): string | undefined {
  try {
    const value: unknown = JSON.parse(raw.trim())
    return typeof value === 'string' ? value : undefined
  } catch {
    // 字段值不是 JSON：按缺失处理，让调用方走降级路径。
    return undefined
  }
}

function assignIfPresent(signal: InboxSignal, key: SourceField, value: string | undefined): void {
  if (value !== undefined) signal[key] = value
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}
