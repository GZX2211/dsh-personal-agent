// src/host/perception/validate.ts
//
// 把模型给的参数收窄成来源定义。
//
// 校验的目标不是「尽量接受」，而是「写入账本的定义一定能被运行时执行」：越界的
// 数量、悬空的线程引用、注定抛错的匹配表达式都在写入之前拒绝，并一次报全所有问题
// ——模型要能一次改完，而不是撞一条改一条。

import type {
  ChannelDefinition,
  DedupeMode,
  FsEventKind,
  HostEventSubscription,
  MatchExpr,
  MatchOp,
  MatchValue,
  SourceDefinition,
  ThreadDefinition,
  ThreadMode,
} from '../../shared/sources.ts'
import {
  CHANNEL_KINDS,
  DEDUPE_MODES,
  FS_EVENT_KINDS,
  MATCH_OPS,
  SOURCE_LIMITS,
  THREAD_MODES,
} from '../../shared/sources.ts'

export type ParseResult<T> = { ok: true; value: T } | { ok: false; errors: string[] }

/** 脚本 Channel 在写入脚本文件之前的形态：路径与哈希由 Host 落盘后回填。 */
export interface ParsedScriptChannel {
  kind: 'script'
  command: string
  args?: string[]
  cwd?: string
  env?: Record<string, string>
  restart?: 'on-failure' | 'never'
}

export type ParsedChannel = Exclude<ChannelDefinition, { kind: 'script' }> | ParsedScriptChannel

export interface ParsedSourceInput {
  name?: string
  description?: string
  enabled?: boolean
  channel?: ParsedChannel
  threads?: ThreadDefinition[]
  /** script Channel 的脚本正文；Host 落盘后转成 `scriptPath` / `scriptHash`。 */
  script?: string
}

export interface ParseSourceOptions {
  /** update 允许只给出要改的字段；create 必须给全。 */
  partial?: boolean
}

const THREAD_ID_LIMIT = 40
const THREAD_NAME_LIMIT = 40
const STATEMENT_LIMIT = 500

/** 脚本重启策略；定义是字面量联合，校验需要运行时枚举。 */
const SCRIPT_RESTART_MODES = ['on-failure', 'never'] as const

export function parseSourceInput(raw: unknown, options: ParseSourceOptions = {}): ParseResult<ParsedSourceInput> {
  if (!isRecord(raw)) return { ok: false, errors: ['参数必须是一个对象'] }

  const partial = options.partial === true
  const errors: string[] = []
  const value: ParsedSourceInput = {}

  const name = readText(raw.name, 'name', errors, { required: !partial, limit: SOURCE_LIMITS.nameLength })
  if (name !== undefined) value.name = name
  const description = readText(raw.description, 'description', errors, { required: false })
  if (description !== undefined) value.description = description
  const enabled = readBoolean(raw.enabled, 'enabled', errors)
  if (enabled !== undefined) value.enabled = enabled

  // 先解析线程，再解析 Channel：订阅与线程引用需要拿线程表校验。
  const threads = parseThreads(raw.threads, errors, partial)
  if (threads !== undefined) value.threads = threads
  const channel = parseChannel(raw.channel, threads ?? [], errors, partial)
  if (channel !== undefined) value.channel = channel

  const script = readText(raw.script, 'script', errors, { required: false })
  if (script !== undefined) {
    if (channel !== undefined && channel.kind !== 'script') {
      errors.push('script 只能用于 script Channel')
    } else if (Buffer.byteLength(script, 'utf8') > SOURCE_LIMITS.scriptBytes) {
      errors.push(`script 不能超过 64 KiB（当前 ${Buffer.byteLength(script, 'utf8')} 字节）`)
    } else {
      value.script = script
    }
  }
  if (channel !== undefined && channel.kind === 'script' && value.script === undefined) {
    errors.push('script Channel 必须提供 script 正文')
  }

  return errors.length === 0 ? { ok: true, value } : { ok: false, errors }
}

/**
 * 复核一份已组装好的定义。
 *
 * 与 {@link parseSourceInput} 的区别：这里输入已经是定义形状，只回答「它能不能被
 * 执行」——主要给装配时从账本还原的来源用（历史账本可能来自更早的版本）。
 */
export function checkSourceDefinition(definition: SourceDefinition): string[] {
  const errors: string[] = []
  if (definition.name.trim().length === 0) errors.push('名称不能为空')
  if ([...definition.name].length > SOURCE_LIMITS.nameLength) {
    errors.push(`名称最多 ${SOURCE_LIMITS.nameLength} 个字符`)
  }
  if (definition.threads.length === 0) errors.push('至少需要一条线程')
  if (definition.threads.length > SOURCE_LIMITS.threadCount) {
    errors.push(`线程最多 ${SOURCE_LIMITS.threadCount} 条`)
  }
  if (definition.channel.kind === 'host-event') {
    for (const subscription of definition.channel.subscriptions) {
      if (!definition.threads.some(thread => thread.id === subscription.thread)) {
        errors.push(`订阅引用的线程 ${subscription.thread} 不存在`)
      }
    }
  }
  if (definition.channel.kind === 'script') {
    if (definition.channel.scriptPath.includes('..')) errors.push('scriptPath 不能越出状态目录')
    if (definition.channel.scriptHash.length === 0) errors.push('scriptHash 不能为空')
  }
  return errors
}

function parseThreads(raw: unknown, errors: string[], partial: boolean): ThreadDefinition[] | undefined {
  if (raw === undefined) {
    if (!partial) errors.push('缺少 threads（至少需要一条线程）')
    return undefined
  }
  if (!Array.isArray(raw)) {
    errors.push('threads 必须是数组')
    return undefined
  }
  if (raw.length === 0) {
    errors.push('至少需要一条线程')
    return undefined
  }
  if (raw.length > SOURCE_LIMITS.threadCount) {
    errors.push(`线程最多 ${SOURCE_LIMITS.threadCount} 条（当前 ${raw.length} 条）`)
  }

  const seen = new Set<string>()
  const threads: ThreadDefinition[] = []
  raw.forEach((item, index) => {
    const at = `threads[${index}]`
    if (!isRecord(item)) {
      errors.push(`${at} 必须是对象`)
      return
    }
    const id = readText(item.id, `${at}.id`, errors, { required: true, limit: THREAD_ID_LIMIT })
    const name = readText(item.name, `${at}.name`, errors, { required: true, limit: THREAD_NAME_LIMIT })
    if (id !== undefined) {
      if (seen.has(id)) errors.push(`${at}.id 与前面的线程重复：${id}`)
      seen.add(id)
    }
    if (id === undefined || name === undefined) return

    const thread: ThreadDefinition = { id, name, enabled: readBoolean(item.enabled, `${at}.enabled`, errors) ?? true }
    const match = parseMatch(item.match, `${at}.match`, errors)
    if (match !== undefined) thread.match = match
    const dedupe = readEnum(item.dedupe, `${at}.dedupe`, DEDUPE_MODES, errors) as DedupeMode | undefined
    if (dedupe !== undefined) thread.dedupe = dedupe
    const minGapSec = readNonNegative(item.minGapSec, `${at}.minGapSec`, errors)
    if (minGapSec !== undefined) thread.minGapSec = minGapSec
    const mode = readEnum(item.mode, `${at}.mode`, THREAD_MODES, errors) as ThreadMode | undefined
    if (mode !== undefined) thread.mode = mode
    const interrupt = readBoolean(item.interrupt, `${at}.interrupt`, errors)
    if (interrupt !== undefined) thread.interrupt = interrupt
    threads.push(thread)
  })
  return threads
}

function parseChannel(
  raw: unknown,
  threads: readonly ThreadDefinition[],
  errors: string[],
  partial: boolean,
): ParsedChannel | undefined {
  if (raw === undefined) {
    if (!partial) errors.push('缺少 channel')
    return undefined
  }
  if (!isRecord(raw)) {
    errors.push('channel 必须是对象')
    return undefined
  }
  const kind = readEnum(raw.kind, 'channel.kind', CHANNEL_KINDS, errors)
  if (kind === undefined) return undefined

  if (kind === 'host-event') return parseHostEventChannel(raw, threads, errors)
  if (kind === 'fs-watch') return parseFsWatchChannel(raw, errors)
  return parseScriptChannel(raw, errors)
}

function parseHostEventChannel(
  raw: Record<string, unknown>,
  threads: readonly ThreadDefinition[],
  errors: string[],
): ParsedChannel | undefined {
  const subscriptions = raw.subscriptions
  if (!Array.isArray(subscriptions) || subscriptions.length === 0) {
    errors.push('host-event 需要至少一条订阅')
    return undefined
  }
  if (subscriptions.length > SOURCE_LIMITS.subscriptionCount) {
    errors.push(`订阅最多 ${SOURCE_LIMITS.subscriptionCount} 条（当前 ${subscriptions.length} 条）`)
  }

  const parsed: HostEventSubscription[] = []
  subscriptions.forEach((item, index) => {
    const at = `channel.subscriptions[${index}]`
    if (!isRecord(item)) {
      errors.push(`${at} 必须是对象`)
      return
    }
    const event = readText(item.event, `${at}.event`, errors, { required: true })
    const thread = readText(item.thread, `${at}.thread`, errors, { required: true })
    const statement = readText(item.statement, `${at}.statement`, errors, {
      required: true,
      limit: STATEMENT_LIMIT,
    })
    if (event === undefined || thread === undefined || statement === undefined) return
    if (threads.length > 0 && !threads.some(candidate => candidate.id === thread)) {
      errors.push(`${at}.thread 引用了不存在的线程：${thread}`)
      return
    }
    parsed.push({ event, thread, statement })
  })
  return { kind: 'host-event', subscriptions: parsed }
}

function parseFsWatchChannel(raw: Record<string, unknown>, errors: string[]): ParsedChannel | undefined {
  const paths = readTextList(raw.paths, 'channel.paths', errors, {
    required: true,
    limit: SOURCE_LIMITS.pathCount,
  })
  if (paths === undefined) return undefined

  const channel: ParsedChannel = { kind: 'fs-watch', paths }
  const recursive = readBoolean(raw.recursive, 'channel.recursive', errors)
  if (recursive !== undefined) channel.recursive = recursive

  const events = readEnumList(raw.events, 'channel.events', FS_EVENT_KINDS, errors)
  if (events !== undefined) channel.events = events as FsEventKind[]
  const ignore = readTextList(raw.ignore, 'channel.ignore', errors, {
    required: false,
    limit: SOURCE_LIMITS.ignoreCount,
  })
  if (ignore !== undefined) channel.ignore = ignore
  const statement = readText(raw.statement, 'channel.statement', errors, {
    required: false,
    limit: STATEMENT_LIMIT,
  })
  if (statement !== undefined) channel.statement = statement
  const debounceMs = readNonNegative(raw.debounceMs, 'channel.debounceMs', errors)
  if (debounceMs !== undefined) channel.debounceMs = debounceMs
  return channel
}

function parseScriptChannel(raw: Record<string, unknown>, errors: string[]): ParsedChannel | undefined {
  const command = readText(raw.command, 'channel.command', errors, { required: true })
  if (command === undefined) return undefined

  const channel: ParsedScriptChannel = { kind: 'script', command }
  const args = readTextList(raw.args, 'channel.args', errors, { required: false })
  if (args !== undefined) channel.args = args
  const cwd = readText(raw.cwd, 'channel.cwd', errors, { required: false })
  if (cwd !== undefined) channel.cwd = cwd
  const env = readStringMap(raw.env, 'channel.env', errors)
  if (env !== undefined) channel.env = env
  const restart = readEnum(raw.restart, 'channel.restart', SCRIPT_RESTART_MODES, errors)
  if (restart !== undefined) channel.restart = restart
  return channel
}

function parseMatch(raw: unknown, at: string, errors: string[]): MatchExpr | undefined {
  if (raw === undefined) return undefined
  if (!isRecord(raw)) {
    errors.push(`${at} 必须是对象`)
    return undefined
  }

  if (raw.all !== undefined || raw.any !== undefined) {
    const branch = raw.all !== undefined ? 'all' : 'any'
    const items = raw[branch]
    if (!Array.isArray(items) || items.length === 0) {
      errors.push(`${at}.${branch} 必须是非空数组`)
      return undefined
    }
    const parsed = items
      .map((item, index) => parseMatch(item, `${at}.${branch}[${index}]`, errors))
      .filter((item): item is MatchExpr => item !== undefined)
    return branch === 'all' ? { all: parsed } : { any: parsed }
  }

  if (raw.not !== undefined) {
    const inner = parseMatch(raw.not, `${at}.not`, errors)
    return inner === undefined ? undefined : { not: inner }
  }

  const path = readText(raw.path, `${at}.path`, errors, { required: true })
  const op = readEnum(raw.op, `${at}.op`, MATCH_OPS, errors) as MatchOp | undefined
  if (path === undefined || op === undefined) return undefined
  const value = readMatchValue(raw.value, op, `${at}.value`, errors)
  return value === undefined ? undefined : { path, op, value }
}

function readMatchValue(value: unknown, op: MatchOp, at: string, errors: string[]): MatchValue | undefined {
  if (op === 'in') {
    if (!Array.isArray(value) || value.length === 0 || !value.every(item => isScalar(item))) {
      errors.push(`${at} 在 op=in 时必须是非空的字符串或数字数组`)
      return undefined
    }
    return value as (string | number)[]
  }
  if (op === 'gt' || op === 'lt') {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      errors.push(`${at} 在 op=${op} 时必须是数字`)
      return undefined
    }
    return value
  }
  if (op === 'regex') {
    if (typeof value !== 'string' || value.length === 0) {
      errors.push(`${at} 在 op=regex 时必须是非空字符串`)
      return undefined
    }
    try {
      new RegExp(value)
    } catch {
      errors.push(`${at} 不是合法的正则表达式`)
      return undefined
    }
    return value
  }
  if (!isScalar(value)) {
    errors.push(`${at} 在 op=${op} 时必须是字符串、数字或布尔值`)
    return undefined
  }
  return value
}

function readText(
  value: unknown,
  field: string,
  errors: string[],
  options: { required: boolean; limit?: number },
): string | undefined {
  if (value === undefined || value === null) {
    if (options.required) errors.push(`${field} 必须提供`)
    return undefined
  }
  if (typeof value !== 'string') {
    errors.push(`${field} 必须是字符串`)
    return undefined
  }
  const text = value.trim()
  if (text.length === 0) {
    if (options.required) errors.push(`${field} 不能为空`)
    return undefined
  }
  if (options.limit !== undefined && [...text].length > options.limit) {
    errors.push(`${field} 最多 ${options.limit} 个字符（当前 ${[...text].length} 个）`)
    return undefined
  }
  return text
}

function readTextList(
  value: unknown,
  field: string,
  errors: string[],
  options: { required: boolean; limit?: number },
): string[] | undefined {
  if (value === undefined) {
    if (options.required) errors.push(`${field} 必须提供`)
    return undefined
  }
  if (!Array.isArray(value) || value.length === 0) {
    if (options.required) errors.push(`${field} 必须是非空数组`)
    return undefined
  }
  if (options.limit !== undefined && value.length > options.limit) {
    errors.push(`${field} 最多 ${options.limit} 项（当前 ${value.length} 项）`)
    return undefined
  }
  const items: string[] = []
  for (const item of value) {
    if (typeof item !== 'string' || item.trim().length === 0) {
      errors.push(`${field} 的每一项都必须是非空字符串`)
      return undefined
    }
    items.push(item.trim())
  }
  return items
}

function readEnumList<T extends string>(
  value: unknown,
  field: string,
  allowed: readonly T[],
  errors: string[],
): T[] | undefined {
  if (value === undefined) return undefined
  if (!Array.isArray(value) || value.length === 0) {
    errors.push(`${field} 必须是非空数组`)
    return undefined
  }
  const items: T[] = []
  for (const item of value) {
    if (!isOneOf(item, allowed)) {
      errors.push(`${field} 的取值必须是 ${allowed.join(' / ')} 之一`)
      return undefined
    }
    items.push(item)
  }
  return items
}

function readEnum<T extends string>(
  value: unknown,
  field: string,
  allowed: readonly T[],
  errors: string[],
): T | undefined {
  if (value === undefined) return undefined
  if (!isOneOf(value, allowed)) {
    errors.push(`${field} 必须是 ${allowed.join(' / ')} 之一`)
    return undefined
  }
  return value
}

function readBoolean(value: unknown, field: string, errors: string[]): boolean | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'boolean') {
    errors.push(`${field} 必须是布尔值`)
    return undefined
  }
  return value
}

function readNonNegative(value: unknown, field: string, errors: string[]): number | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    errors.push(`${field} 必须是非负数字`)
    return undefined
  }
  return value
}

function readStringMap(value: unknown, field: string, errors: string[]): Record<string, string> | undefined {
  if (value === undefined) return undefined
  if (!isRecord(value)) {
    errors.push(`${field} 必须是对象`)
    return undefined
  }
  const map: Record<string, string> = {}
  for (const [key, item] of Object.entries(value)) {
    if (typeof item !== 'string') {
      errors.push(`${field}.${key} 必须是字符串`)
      return undefined
    }
    map[key] = item
  }
  return map
}

function isScalar(value: unknown): value is string | number | boolean {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
}

function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
