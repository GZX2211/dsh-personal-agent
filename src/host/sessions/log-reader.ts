// src/host/sessions/log-reader.ts
//
// 读一条会话的持久化事件。会话日志是追加的压缩帧，不能按普通文本读；这里统一走
// 持久化读句柄，供启动自愈等需要「复核会话里到底发生过什么」的地方复用。

import type { SessionEvent, SessionId } from '@deepseek-ai/dsh-session'
import type { HostContext } from '../context.ts'

/** 每页最多取多少条事件；句柄按页推进，不一次性拉全量。 */
const PAGE_SIZE = 256

export async function readSessionEvents(ctx: HostContext, sessionId: SessionId): Promise<SessionEvent[]> {
  await ctx.sessionPersistence.flush()
  const handle = await ctx.sessionPersistence.open(sessionId, 'read')
  try {
    const events: SessionEvent[] = []
    for (let offset = 0; ; ) {
      const page = await handle.read(offset, PAGE_SIZE)
      if (page.events.length === 0) break
      for (const event of page.events) events.push(event as SessionEvent)
      offset += page.events.length
    }
    return events
  } finally {
    await handle[Symbol.asyncDispose]()
  }
}
