// src/host/sessions/detail-sessions.ts
//
// 详情页要读哪些会话：负责人在内的整棵树。
//
// 从负责人出发做广度优先：catalog 登记的子代理（递归）+ 窗口内投递过消息的会话。
// 后者覆盖跨单复用的旧子代理——它不在本单的登记里，但它在窗口内说过话。
// 读不出来的会话照样留在结果里：链上要能显示「这条会话的日志不可读」，而不是
// 让它悄无声息地消失。

import type { SessionEvent, SessionId } from '@deepseek-ai/dsh-session'
import type { HostContext } from '../context.ts'
import { readSessionWindow, type SessionWindow } from './session-window.ts'

/** 一次详情最多读多少个会话：深树不该让一次轮询读掉半本日志。 */
export const DETAIL_SESSION_LIMIT = 8

export interface DetailSessionsOptions {
  start: number
  end: number
  /** 覆盖默认上限；测试与将来的紧凑视图可能用更小的窗口。 */
  limit?: number
}

export async function readDetailSessions(
  ctx: HostContext,
  rootSessionId: SessionId | undefined,
  options: DetailSessionsOptions,
): Promise<Map<string, SessionWindow>> {
  const sessions = new Map<string, SessionWindow>()
  if (rootSessionId === undefined) return sessions

  const limit = options.limit ?? DETAIL_SESSION_LIMIT
  const queue: string[] = [rootSessionId]
  while (queue.length > 0 && sessions.size < limit) {
    const sessionId = queue.shift()
    if (sessionId === undefined || sessions.has(sessionId)) continue
    const window = await readSessionWindow(ctx, sessionId as SessionId, {
      start: options.start,
      end: options.end,
    })
    sessions.set(sessionId, window)
    for (const child of window.children) {
      if (!sessions.has(child.childId)) queue.push(child.childId)
    }
    for (const sender of sendersOf(window.events)) {
      if (!sessions.has(sender)) queue.push(sender)
    }
  }
  return sessions
}

/** 窗口内主动投递过的会话：消息接收方那侧记录了 senderSessionId。 */
function sendersOf(events: readonly SessionEvent[]): string[] {
  const senders: string[] = []
  for (const event of events) {
    if (event.type !== 'user/message') continue
    const source = (event.data as { source?: { kind?: string; senderSessionId?: string } }).source
    if (source?.kind !== 'agent-message' || typeof source.senderSessionId !== 'string') continue
    if (!senders.includes(source.senderSessionId)) senders.push(source.senderSessionId)
  }
  return senders
}
