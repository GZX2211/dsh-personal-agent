// src/host/sessions/session-window.ts
//
// 读一条会话在某个时间窗口内的日志：活会话读内存快照，冷会话读持久化。
//
// 窗口是详情页裁剪历史的唯一手段：追加单共用一个执行会话，上一单的事件必须被
// 裁掉，否则链上会混进不属于这单的投递。
//
// 子代理登记（catalog）不吃窗口裁剪：复用的旧子代理在本单照样可能参与，只是不该
// 画 spawn 行。它因此从事件流里摘出来，单独作为登记返回。

import type { SessionEvent, SessionId } from '@deepseek-ai/dsh-session'
import type { DetailLogState } from '../../shared/ticket-detail.ts'
import type { HostContext } from '../context.ts'
import type { DetailSessionChild, DetailSessionInput } from '../projector/ticket-detail.ts'
import { readSessionEvents } from './log-reader.ts'

/** 单会话读取上限：超出取尾部并标 partial，页面不因此失败。 */
export const SESSION_EVENT_LIMIT = 3000

/**
 * 子代理登记的事件名。
 *
 * 刻意用 `string` 而不是字面量：catalog 由子代理包在运行时增强进会话事件表，
 * 本插件依赖的宿主类型里没有它。按字符串判定即可兼容两个版本，也不会把一条
 * 只存在于运行时的登记当成类型错误。
 */
const SUBAGENT_CATALOG_EVENT: string = 'subagent/catalog'

export interface SessionWindowOptions {
  /** 窗口起点（含）。 */
  start: number
  /** 窗口终点（含）。 */
  end: number
  /** 覆盖默认上限；测试与将来的紧凑视图可能用更小的窗口。 */
  limit?: number
}

export interface SessionWindow extends DetailSessionInput {
  sessionId: string
}

/**
 * 读一个窗口。
 *
 * 只读不写：调用方（详情装配）负责决定是否值得读——排队中的工单还没有会话。
 * 读失败降级为 `unavailable` 并带上原因，让页面能说清「为什么只有账本事实」。
 */
export async function readSessionWindow(
  ctx: HostContext,
  sessionId: SessionId,
  options: SessionWindowOptions,
): Promise<SessionWindow> {
  const limit = options.limit ?? SESSION_EVENT_LIMIT
  let events: readonly SessionEvent[]
  try {
    events = await readAll(ctx, sessionId)
  } catch (error) {
    return { sessionId, events: [], children: [], completeness: 'unavailable', reason: describe(error) }
  }

  const children = collectChildren(events)
  const inWindow = events
    .filter(
      event =>
        event.type !== SUBAGENT_CATALOG_EVENT &&
        event.time >= options.start &&
        event.time <= options.end,
    )
    .sort((left, right) => left.seq - right.seq)
  if (inWindow.length <= limit) {
    return { sessionId, events: inWindow, children, completeness: 'full' }
  }
  // 截断时保留最近的尾部：一条长工单的现状比它的开头更值得看。
  return {
    sessionId,
    events: inWindow.slice(inWindow.length - limit),
    children,
    completeness: 'partial',
    reason: `window truncated to the last ${limit} events (${inWindow.length} in total)`,
  }
}

async function readAll(ctx: HostContext, sessionId: SessionId): Promise<readonly SessionEvent[]> {
  const agent = ctx.agents.get(sessionId)
  // 活会话的内存快照更新更及时：持久化可能还差一次 flush。
  if (agent !== undefined) return agent.session.snapshotEvents()
  return readSessionEvents(ctx, sessionId)
}

/**
 * 折叠全部 catalog 事件。
 *
 * 形状按运行时守卫收窄：子代理包的登记版本会演进，读到不认识的字段就跳过，
 * 而不是让一整页详情因为一条登记读不懂而失败。
 */
function collectChildren(events: readonly SessionEvent[]): DetailSessionChild[] {
  const children: DetailSessionChild[] = []
  const seen = new Set<string>()
  for (const event of events) {
    if (event.type !== SUBAGENT_CATALOG_EVENT) continue
    const data = event.data as {
      childId?: unknown
      childCreatedAt?: unknown
      name?: unknown
      label?: unknown
    }
    if (typeof data.childId !== 'string' || typeof data.childCreatedAt !== 'number') continue
    if (seen.has(data.childId)) continue
    seen.add(data.childId)
    children.push({
      childId: data.childId,
      childCreatedAt: data.childCreatedAt,
      ...(typeof data.name === 'string' ? { name: data.name } : {}),
      ...(typeof data.label === 'string' ? { label: data.label } : {}),
    })
  }
  return children
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
