// src/host/sessions/session-window.ts
//
// 读一条会话在某个时间窗口内的日志：活会话读内存快照，冷会话读持久化。
//
// 窗口是详情页裁剪历史的唯一手段：追加单共用一个执行会话，上一单的事件必须被
// 裁掉，否则链上会混进不属于这单的投递。

import type { SessionEvent, SessionId } from '@deepseek-ai/dsh-session'
import type { DetailLogState } from '../../shared/ticket-detail.ts'
import type { HostContext } from '../context.ts'
import { readSessionEvents } from './log-reader.ts'

/** 单会话读取上限：超出取尾部并标 partial，页面不因此失败。 */
export const SESSION_EVENT_LIMIT = 3000

export interface SessionWindowOptions {
  /** 窗口起点（含）。 */
  start: number
  /** 窗口终点（含）。 */
  end: number
  /** 覆盖默认上限；测试与将来的紧凑视图可能用更小的窗口。 */
  limit?: number
}

export interface SessionWindow {
  sessionId: string
  /** 窗口内的事件，按 seq 升序。 */
  events: readonly SessionEvent[]
  completeness: DetailLogState
  reason?: string
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
    return {
      sessionId,
      events: [],
      completeness: 'unavailable',
      reason: describe(error),
    }
  }

  const inWindow = events
    .filter(event => event.time >= options.start && event.time <= options.end)
    .sort((left, right) => left.seq - right.seq)
  if (inWindow.length <= limit) {
    return { sessionId, events: inWindow, completeness: 'full' }
  }
  // 截断时保留最近的尾部：一条长工单的现状比它的开头更值得看。
  return {
    sessionId,
    events: inWindow.slice(inWindow.length - limit),
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

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
