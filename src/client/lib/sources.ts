// src/client/lib/sources.ts
//
// 来源页的纯展示逻辑：渠道/状态/配置摘要/定时节奏。不读环境，语言与词典由调用方
// 传进来；界面文案一律来自词典，只有数字、时间与表达式是本地化格式化的结果。

import { ERROR_CODES } from '../../shared/api.ts'
import type { ChannelKind, SourceConfigView, SourceStatus, TimerTiming } from '../../shared/sources.ts'
import type { Dict, Translate } from '../i18n.ts'
import { formatTimestamp } from './format.ts'

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
 * 时长文案：单位与复数交给 Intl，中文与英文都得到自然的「5 分钟 / 5 minutes」。
 *
 * 大于一分钟的值按最近的整单位取整：说「2 分钟」比「1.5 分钟」更像人能读的摘要。
 */
export function formatDuration(language: string, seconds: number): string {
  const total = Math.max(0, Math.round(seconds))
  const [amount, unit] = durationUnit(total)
  return new Intl.NumberFormat(localeOf(language), {
    style: 'unit',
    unit,
    unitDisplay: 'short',
  }).format(amount)
}

function durationUnit(seconds: number): [number, 'second' | 'minute' | 'hour' | 'day'] {
  if (seconds < 60) return [seconds, 'second']
  if (seconds < 3_600) return [Math.round(seconds / 60), 'minute']
  if (seconds < 86_400) return [Math.round(seconds / 3_600), 'hour']
  return [Math.round(seconds / 86_400), 'day']
}

/** 定时来源的节奏摘要：「周期 · 5 分钟」「每周 · 周一 09:00 (Asia/Shanghai)」。 */
export function timerTimingText(t: Translate, language: string, timing: TimerTiming): string {
  switch (timing.kind) {
    case 'after':
      return `${t('timerAfter')} · ${formatDuration(language, timing.afterSeconds)}`
    case 'every':
      return `${t('timerEvery')} · ${formatDuration(language, timing.everySeconds)}`
    case 'at':
      return `${t('timerAt')} · ${atText(language, timing.scheduledAt)}`
    case 'daily':
      return `${t('timerDaily')} · ${timing.time} (${timing.timeZone})`
    case 'weekly':
      return `${t('timerWeekly')} · ${weekdaysText(language, timing.weekdays)} ${timing.time} (${timing.timeZone})`
    case 'cron':
      return `${t('timerCron')} · ${timing.expression} (${timing.timeZone})`
    case 'rrule':
      return `${t('timerRrule')} · ${timing.rrule}`
  }
}

/** 官方任务的周几编号以周日为 0；用固定的 UTC 日期取本地化名称。 */
function weekdaysText(language: string, weekdays: readonly number[]): string {
  const formatter = new Intl.DateTimeFormat(localeOf(language), {
    weekday: 'short',
    timeZone: 'UTC',
  })
  const names = weekdays.map(day => formatter.format(new Date(Date.UTC(2024, 0, 7 + day))))
  return listText(language, names)
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

/** 时间戳解析失败时保留原始文本：展示一个没解析成功的值好过显示 Invalid Date。 */
function atText(language: string, value: string): string {
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? formatTimestamp(language, parsed) : value
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
