// src/host/perception/timers.ts
//
// 定时来源的只读视图。
//
// 定时任务由官方调度器拥有，本插件不创建也不修改；这里只把「投递给 router 会话的
// 那些任务」翻译成来源页能展示的形状。节奏字段是官方条目的扁平字段，视图按 kind
// 重建一个统一结构，展示文案由 Client 用词典生成。

import type { TimerSourceView, TimerTiming } from '../../shared/sources.ts'
import type { SourceTally } from '../projector/project.ts'

/** 官方调度服务的最小读面：本插件只读 catalog，不创建也不修改任务。 */
export interface ScheduleService {
  catalog(): Promise<readonly ScheduleCatalogEntry[]>
}

/**
 * 官方调度条目的最小结构：只声明本插件读取的字段。
 *
 * 不引入官方类型包的原因：它的版本与本插件的宿主版本不同，直接依赖会把发行版的
 * 内部形状钉死。字段缺失或类型漂移时按未知 kind 丢弃，不影响快照其余部分。
 */
export interface ScheduleCatalogEntry {
  readonly id: string
  readonly kind: string
  readonly title: string
  readonly scheduledAt: string
  readonly status: 'active' | 'paused' | 'ended'
  readonly target: { readonly kind: string; readonly sessionId?: string }
  readonly afterSeconds?: number
  readonly everySeconds?: number
  readonly time?: string
  readonly timeZone?: string
  readonly weekdays?: number[]
  readonly expression?: string
  readonly rrule?: string
}

/** 信号聚合出的投递计数，与感知来源同一口径。 */
export interface TimerTally {
  delivered: number
  lastDeliveredAt?: number
}

/**
 * 把官方任务翻译成只读视图。
 *
 * 只有投递目标是 router 会话本身的任务才算个人代理的输入；`new` / `new_once`
 * 会把消息送去新建的会话，那不是 router 的输入。
 */
export function toTimerSourceViews(
  entries: readonly ScheduleCatalogEntry[],
  routerSessionId: string | undefined,
  tallies: ReadonlyMap<string, TimerTally>,
): TimerSourceView[] {
  if (routerSessionId === undefined) return []

  const views: TimerSourceView[] = []
  for (const entry of entries) {
    if (entry.target.kind !== 'session' || entry.target.sessionId !== routerSessionId) continue
    const timing = toTiming(entry)
    // 不认识的节奏结构无法展示，也无法解释它何时触发；丢弃而不是给一个假摘要。
    if (timing === undefined) continue

    const tally = tallies.get(entry.id)
    const view: TimerSourceView = {
      scheduleId: entry.id,
      title: entry.title,
      active: entry.status === 'active',
      timing,
      deliveredCount: tally?.delivered ?? 0,
    }
    const nextAt = Date.parse(entry.scheduledAt)
    if (Number.isFinite(nextAt)) view.nextAt = nextAt
    if (tally?.lastDeliveredAt !== undefined) view.lastDeliveredAt = tally.lastDeliveredAt
    views.push(view)
  }
  return views
}

/**
 * 读取定时来源视图。
 *
 * 官方调度器可能未挂载、也可能读取失败：两种情况下定时分区都降级为空数组，
 * 不影响快照其余部分（来源页的其余分区仍然可用）。
 */
export async function readTimerSourceViews(
  schedule: ScheduleService | undefined,
  routerSessionId: string | undefined,
  tallies: ReadonlyMap<string, SourceTally>,
  log?: (message: string) => void,
): Promise<TimerSourceView[]> {
  if (schedule === undefined || routerSessionId === undefined) return []
  try {
    const entries = await schedule.catalog()
    return toTimerSourceViews(entries, routerSessionId, toTimerTallies(tallies))
  } catch (error) {
    log?.(`schedule catalog unavailable: ${error instanceof Error ? error.message : String(error)}`)
    return []
  }
}

function toTimerTallies(tallies: ReadonlyMap<string, SourceTally>): Map<string, TimerTally> {
  const counts = new Map<string, TimerTally>()
  for (const [sourceId, tally] of tallies) {
    counts.set(sourceId, {
      delivered: tally.delivered,
      ...(tally.lastDeliveredAt === undefined ? {} : { lastDeliveredAt: tally.lastDeliveredAt }),
    })
  }
  return counts
}

function toTiming(entry: ScheduleCatalogEntry): TimerTiming | undefined {
  switch (entry.kind) {
    case 'after':
      return entry.afterSeconds === undefined ? undefined : { kind: 'after', afterSeconds: entry.afterSeconds }
    case 'at':
      return { kind: 'at', scheduledAt: entry.scheduledAt }
    case 'every':
      return entry.everySeconds === undefined ? undefined : { kind: 'every', everySeconds: entry.everySeconds }
    case 'daily':
      return entry.time === undefined || entry.timeZone === undefined
        ? undefined
        : { kind: 'daily', time: entry.time, timeZone: entry.timeZone }
    case 'weekly':
      return entry.time === undefined || entry.timeZone === undefined || entry.weekdays === undefined
        ? undefined
        : { kind: 'weekly', time: entry.time, timeZone: entry.timeZone, weekdays: entry.weekdays }
    case 'cron':
      return entry.expression === undefined || entry.timeZone === undefined
        ? undefined
        : { kind: 'cron', expression: entry.expression, timeZone: entry.timeZone }
    case 'rrule':
      return entry.rrule === undefined ? undefined : { kind: 'rrule', rrule: entry.rrule }
    default:
      return undefined
  }
}
