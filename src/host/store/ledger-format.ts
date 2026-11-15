// src/host/store/ledger-format.ts
//
// 账本行的编解码与重放。重放是唯一读路径：完整行必须可理解；半行只可能出现在
// 文件尾部（写入被断电截断），其余异常都以可行动的损坏错误报出，绝不静默丢事实。

import {
  EVENT_ACTORS,
  EVENT_TYPES,
  type EventActor,
  type EventType,
  type L1Ref,
  type L2Event,
} from '../../shared/events.ts'
import { checkPayload, isRecord } from './payload-spec.ts'

/** 账本文件名；与 `events.jsonl` 在方案 §2.2 中固定。 */
export const EVENTS_FILE_NAME = 'events.jsonl'

const KNOWN_TYPES: ReadonlySet<string> = new Set(Object.values(EVENT_TYPES))

/** 一条完整的账本行；不是合法事件就是损坏记录。 */
export class LedgerCorruptionError extends Error {
  constructor(
    readonly lineNumber: number,
    detail: string,
  ) {
    super(`${EVENTS_FILE_NAME} line ${lineNumber}: ${detail}`)
    this.name = 'LedgerCorruptionError'
  }
}

export interface ReplayResult {
  /** 可理解的已知事件，按文件顺序。 */
  events: L2Event[]
  /** 账本内出现过的最大 seq（含跳过的未知类型），下一次 append 从这里续号。 */
  lastSeq: number
  /** 尾部残行需要截断到的字节长度；文件完整时不存在。 */
  truncateTo?: number
  /** 降级事实：尾部残行、未知事件类型、重复行。 */
  warnings: string[]
}

/** 一行事件的确切落盘形态：单行 JSON + 换行。 */
export function encodeLedgerLine(event: L2Event): string {
  return `${JSON.stringify(event)}\n`
}

/**
 * 把账本文件内容还原为事件序列。
 *
 * @param bytes - 文件原始字节。调用方负责读取；本函数不碰文件系统，便于故障注入。
 * @throws LedgerCorruptionError 完整行损坏、序号断裂或载荷不合契约时。
 */
export function replayLedger(bytes: Buffer): ReplayResult {
  const events: L2Event[] = []
  const warnings: string[] = []
  const seenEventIds = new Set<string>()
  let lastSeq = 0

  if (bytes.length === 0) return { events, lastSeq, warnings }

  const completeEnd = bytes.lastIndexOf(0x0a) + 1
  const truncateTo = completeEnd < bytes.length ? completeEnd : undefined
  if (truncateTo !== undefined) {
    warnings.push(
      `events.jsonl: truncated ${bytes.length - truncateTo} trailing byte(s) of an incomplete last line (interrupted write?)`,
    )
  }

  const lines = bytes.subarray(0, completeEnd).toString('utf8').split('\n')
  lines.pop() // 文本以换行结尾，split 的末项是空串。

  for (const [index, rawLine] of lines.entries()) {
    const lineNumber = index + 1
    // 容忍手工编辑留下的 CRLF：账本行本身只以 \n 结尾。
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine
    if (line.trim().length === 0) continue

    const envelope = parseEnvelope(line, lineNumber)
    if (envelope.seq <= lastSeq) {
      throw new LedgerCorruptionError(lineNumber, `seq ${envelope.seq} is not greater than ${lastSeq}`)
    }
    if (envelope.seq !== lastSeq + 1) {
      throw new LedgerCorruptionError(lineNumber, `expected seq ${lastSeq + 1} but found ${envelope.seq}`)
    }
    lastSeq = envelope.seq

    if (!KNOWN_TYPES.has(envelope.type)) {
      warnings.push(
        `events.jsonl: skipped unknown event type "${envelope.type}" at line ${lineNumber} (written by a newer version?)`,
      )
      continue
    }
    if (seenEventIds.has(envelope.eventId)) {
      warnings.push(`events.jsonl: skipped duplicate eventId ${envelope.eventId} at line ${lineNumber}`)
      continue
    }

    const payloadProblem = checkPayload(envelope.type as EventType, envelope.payload)
    if (payloadProblem !== undefined) {
      throw new LedgerCorruptionError(lineNumber, payloadProblem)
    }

    seenEventIds.add(envelope.eventId)
    // 信封与载荷都已按契约校验，此处补齐判别联合的窄类型。
    events.push({ ...envelope, type: envelope.type as EventType, payload: envelope.payload } as unknown as L2Event)
  }

  return truncateTo === undefined ? { events, lastSeq, warnings } : { events, lastSeq, truncateTo, warnings }
}

interface ParsedEnvelope {
  seq: number
  eventId: string
  type: string
  time: number
  actor: EventActor
  correlationId: string
  causationId?: string
  sessionId?: string
  policyVersion?: string
  l1Ref?: L1Ref
  payload: Record<string, unknown>
}

function parseEnvelope(line: string, lineNumber: number): ParsedEnvelope {
  let value: unknown
  try {
    value = JSON.parse(line)
  } catch (error) {
    throw new LedgerCorruptionError(lineNumber, `invalid JSON (${describe(error)})`)
  }
  const problem = envelopeProblem(value)
  if (problem !== undefined) throw new LedgerCorruptionError(lineNumber, problem)
  return value as ParsedEnvelope
}

function envelopeProblem(value: unknown): string | undefined {
  if (!isRecord(value)) return 'event must be a JSON object'
  if (!Number.isInteger(value.seq) || (value.seq as number) < 1) return 'seq must be a positive integer'
  if (typeof value.eventId !== 'string' || !/^[0-9a-f]{32}$/.test(value.eventId)) {
    return 'eventId must be 32 lowercase hex characters'
  }
  if (typeof value.type !== 'string' || value.type.length === 0) return 'type must be a non-empty string'
  if (typeof value.time !== 'number' || !Number.isFinite(value.time)) return 'time must be a finite number'
  if (!EVENT_ACTORS.includes(value.actor as EventActor)) return `actor must be one of ${EVENT_ACTORS.join(', ')}`
  if (typeof value.correlationId !== 'string' || value.correlationId.length === 0) {
    return 'correlationId must be a non-empty string'
  }
  for (const optional of ['causationId', 'sessionId', 'policyVersion'] as const) {
    if (value[optional] !== undefined && typeof value[optional] !== 'string') {
      return `${optional} must be a string when present`
    }
  }
  if (value.l1Ref !== undefined) {
    if (!isRecord(value.l1Ref)) return 'l1Ref must be { sessionId: string, seq: number }'
    if (typeof value.l1Ref.sessionId !== 'string' || !Number.isInteger(value.l1Ref.seq)) {
      return 'l1Ref must be { sessionId: string, seq: number }'
    }
  }
  if (!isRecord(value.payload)) return 'payload must be an object'
  return undefined
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
