// src/shared/sources.ts
//
// 感知来源的契约：来源是用户可开关的感知单元，内含一个 Channel 与若干线程。
// 定义随账本存储（`source/*` 事件），视图是它的展示形态；运行时状态不属于定义。

export const CHANNEL_KINDS = ['host-event', 'fs-watch', 'script'] as const

export type ChannelKind = (typeof CHANNEL_KINDS)[number]

export const FS_EVENT_KINDS = ['add', 'change', 'unlink'] as const

export type FsEventKind = (typeof FS_EVENT_KINDS)[number]

export const MATCH_OPS = ['eq', 'neq', 'contains', 'startsWith', 'endsWith', 'regex', 'in', 'gt', 'lt'] as const

export type MatchOp = (typeof MATCH_OPS)[number]

export type MatchValue = string | number | boolean | (string | number)[]

/** 确定性匹配表达式；`path` 支持 `payload.outcome` 这类点路径。 */
export type MatchExpr =
  | { path: string; op: MatchOp; value: MatchValue }
  | { all: MatchExpr[] }
  | { any: MatchExpr[] }
  | { not: MatchExpr }

export const DEDUPE_MODES = ['externalId', 'statement', 'none'] as const

export type DedupeMode = (typeof DEDUPE_MODES)[number]

export const THREAD_MODES = ['level', 'edge'] as const

export type ThreadMode = (typeof THREAD_MODES)[number]

export interface ThreadDefinition {
  id: string
  name: string
  enabled: boolean
  match?: MatchExpr
  dedupe?: DedupeMode
  /** 同一线程两条投递之间的最小间隔（秒）；缺省 0。 */
  minGapSec?: number
  mode?: ThreadMode
  /** true 时用 steer 插入 router 当前回合的下一步。 */
  interrupt?: boolean
}

export interface HostEventSubscription {
  /** L2 事件类型，如 `task/closed`。 */
  event: string
  /** 归属线程 id。 */
  thread: string
  /** 陈述模板，支持 `{payload.ticketId}` 这类点路径插值。 */
  statement: string
}

export interface HostEventChannel {
  kind: 'host-event'
  subscriptions: HostEventSubscription[]
}

export interface FsWatchChannel {
  kind: 'fs-watch'
  paths: string[]
  recursive?: boolean
  events?: FsEventKind[]
  ignore?: string[]
  debounceMs?: number
  /** 缺省 `{event} {path}`。 */
  statement?: string
}

export interface ScriptChannel {
  kind: 'script'
  command: string
  args?: string[]
  cwd?: string
  env?: Record<string, string>
  restart?: 'on-failure' | 'never'
  /** 相对状态目录的脚本路径；由 Host 落盘。 */
  scriptPath: string
  /** 脚本内容 sha256，用于检测手改。 */
  scriptHash: string
}

export type ChannelDefinition = HostEventChannel | FsWatchChannel | ScriptChannel

export interface SourceDefinition {
  id: string
  name: string
  description?: string
  enabled: boolean
  channel: ChannelDefinition
  threads: ThreadDefinition[]
  createdAt: number
  updatedAt: number
}

/** 来源的数量与长度上限：Host 用它校验，Client 用它生成提示文案。 */
export const SOURCE_LIMITS = {
  /** 全部来源的数量上限。 */
  sourceCount: 32,
  /** 来源名称的最大字符数。 */
  nameLength: 60,
  /** 单个来源的线程数量上限。 */
  threadCount: 8,
  /** host-event 订阅数量上限。 */
  subscriptionCount: 20,
  /** fs-watch 路径数量上限。 */
  pathCount: 8,
  /** fs-watch 忽略模式数量上限。 */
  ignoreCount: 20,
  /** 脚本正文的字节上限。 */
  scriptBytes: 64 * 1024,
} as const

/** 定时来源的节奏；Host 从官方任务重建，Client 据此生成摘要文案。 */
export type TimerTiming =
  | { kind: 'after'; afterSeconds: number }
  | { kind: 'at'; scheduledAt: string }
  | { kind: 'every'; everySeconds: number }
  | { kind: 'daily'; time: string; timeZone: string }
  | { kind: 'weekly'; time: string; timeZone: string; weekdays: number[] }
  | { kind: 'cron'; expression: string; timeZone: string }
  | { kind: 'rrule'; rrule: string }

export const SOURCE_STATUSES = ['running', 'stopped', 'error'] as const

export type SourceStatus = (typeof SOURCE_STATUSES)[number]

export interface SourceThreadView {
  id: string
  name: string
  enabled: boolean
  deliveredCount: number
  filteredCount: number
  lastEventAt?: number
}

/**
 * 来源的配置摘要：只带来源页要展示的部分。
 *
 * 不含脚本文本与哈希、也不含 ignore 模式——它们是实现细节，对「这个来源在盯什么」
 * 没有帮助，却会把定义全文塞进每次轮询。
 */
export type SourceConfigView =
  | { kind: 'host-event'; events: string[] }
  | { kind: 'fs-watch'; paths: string[]; recursive: boolean; debounceMs?: number }
  | { kind: 'script'; command: string }

/** 来源页的一条感知来源卡片。 */
export interface SourceView {
  id: string
  name: string
  description?: string
  enabled: boolean
  channelKind: ChannelKind
  config: SourceConfigView
  /** 运行时状态；来自内存，不落账。 */
  status: SourceStatus
  lastError?: string
  threads: SourceThreadView[]
  deliveredCount: number
  filteredCount: number
  lastEventAt?: number
}

/**
 * 投影能产出的来源视图：定义与计数，不含运行时状态。
 *
 * 状态只在 Host 内存里（Channel 是否挂上），组装快照时补上；账本不记录运行状态，
 * 因为「曾经运行过」不是可回放的事实。
 */
export type SourceSnapshot = Omit<SourceView, 'status' | 'lastError'>

/** 来源页的只读定时分区：定时任务由官方调度器管理，这里只读。 */
export interface TimerSourceView {
  scheduleId: string
  title: string
  active: boolean
  timing: TimerTiming
  nextAt?: number
  deliveredCount: number
  lastDeliveredAt?: number
}
