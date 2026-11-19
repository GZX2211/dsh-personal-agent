// src/client/lib/sources.ts
//
// 来源页的纯展示逻辑：渠道/状态/配置摘要与搜索。不读环境，语言与词典由调用方
// 传进来；界面文案一律来自词典，只有路径、事件名与命令原样展示。

import { ERROR_CODES } from '../../shared/api.ts'
import type { ChannelKind, SourceConfigView, SourceStatus, SourceView } from '../../shared/sources.ts'
import type { Dict, Translate } from '../i18n.ts'
import { buildHaystack, matchesQuery, tokenizeQuery, type FilterContext } from './filter.ts'

const CHANNEL_KEYS: Record<ChannelKind, keyof Dict> = {
  'host-event': 'sourceChannelHostEvent',
  'fs-watch': 'sourceChannelFsWatch',
  script: 'sourceChannelScript',
}

const STATUS_KEYS: Record<SourceStatus, keyof Dict> = {
  running: 'sourceStatusRunning',
  stopped: 'sourceStatusStopped',
  error: 'sourceStatusError',
}

/** 运行时状态对应的官方状态点。 */
export type SourceStateDot = 'done' | 'idle' | 'error'

const STATUS_DOTS: Record<SourceStatus, SourceStateDot> = {
  running: 'done',
  stopped: 'idle',
  error: 'error',
}

export function channelKindKey(kind: ChannelKind): keyof Dict {
  return CHANNEL_KEYS[kind]
}

export function sourceStatusKey(status: SourceStatus): keyof Dict {
  return STATUS_KEYS[status]
}

export function sourceStatusDot(status: SourceStatus): SourceStateDot {
  return STATUS_DOTS[status]
}

export function threadCountText(t: Translate, count: number): string {
  return t('sourcesThreadCount', { count })
}

/** 乐观覆盖的键：来源与线程的组合，避免两个来源的同名线程互相覆盖。 */
export function threadOverrideKey(sourceId: string, threadId: string): string {
  return `${sourceId}/${threadId}`
}

/**
 * 页面里的开关值：有乐观覆盖时用覆盖值，否则回到快照事实。
 *
 * 写请求失败时页面清掉覆盖，于是这里自动回到快照——回滚不需要另存一份旧值。
 */
export function sourceEnabledOf(
  source: SourceView,
  overrides: Readonly<Record<string, boolean>>,
): boolean {
  return overrides[source.id] ?? source.enabled
}

/** 该来源各线程的乐观覆盖值；没有覆盖的线程不出现在结果里。 */
export function threadOverridesFor(
  source: SourceView,
  overrides: Readonly<Record<string, boolean>>,
): Record<string, boolean> {
  const record: Record<string, boolean> = {}
  for (const thread of source.threads) {
    const value = overrides[threadOverrideKey(source.id, thread.id)]
    if (value !== undefined) record[thread.id] = value
  }
  return record
}

/** 配置摘要的取值：路径、订阅的事件类型或脚本命令。 */
export function sourceConfigText(language: string, config: SourceConfigView): string {
  switch (config.kind) {
    case 'host-event':
      return listText(language, config.events)
    case 'fs-watch':
      return listText(language, config.paths)
    case 'script':
      return config.command
  }
}

/**
 * 来源搜索的 haystack：名称、说明、线程名、配置摘要、渠道与状态。
 *
 * 与卡片上看得见的字段一致；不搜 id 与脚本路径——用户不知道也不关心它们。
 */
export function sourceHaystack(source: SourceView, ctx: FilterContext): string {
  return buildHaystack([
    source.name,
    source.description,
    source.threads.map(thread => thread.name),
    sourceConfigText(ctx.language, source.config),
    ctx.t(channelKindKey(source.channelKind)),
    ctx.t(sourceStatusKey(source.status)),
  ])
}

export function filterSources(
  sources: readonly SourceView[],
  query: string,
  ctx: FilterContext,
): SourceView[] {
  const tokens = tokenizeQuery(query)
  return sources.filter(source => matchesQuery(sourceHaystack(source, ctx), tokens))
}

function listText(language: string, values: readonly string[]): string {
  if (values.length === 0) return ''
  // narrow 的并列连接在中文是顿号、英文是逗号，比 conjunction 的「和 / and」更像列表。
  return new Intl.ListFormat(localeOf(language), { style: 'narrow', type: 'conjunction' }).format(
    values,
  )
}

function localeOf(language: string): string {
  return language.length > 0 ? language : 'en'
}

const SOURCE_ERROR_KEYS: Record<string, keyof Dict> = {
  [ERROR_CODES.sourceNotFound]: 'sourceErrorNotFound',
  [ERROR_CODES.sourceInvalid]: 'sourceErrorInvalid',
  [ERROR_CODES.sourceStartFailed]: 'sourceErrorStartFailed',
}

/** 稳定错误码 → 词典键；未知码也要有可读文案。 */
export function sourceErrorKey(code: string): keyof Dict {
  return SOURCE_ERROR_KEYS[code] ?? 'sourceErrorUnknown'
}
