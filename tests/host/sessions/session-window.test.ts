// tests/host/sessions/session-window.test.ts
//
// 会话窗口是详情页的读日志边界：只取本单开始之后的事件（追加单必须裁掉上一单），
// 读不到就降级而不是整页失败，超出上限取尾部并标 partial。

import type { SessionEvent, SessionId } from '@deepseek-ai/dsh-session'
import { beforeEach, describe, expect, it } from 'vitest'
import { readSessionWindow, SESSION_EVENT_LIMIT } from '../../../src/host/sessions/session-window.ts'
import { createFakeHost, type FakeHost } from '../../support/fake-host.ts'

const LIVE = 'session-live' as SessionId
const COLD = 'session-cold' as SessionId
const START = 1_700_000_000_000
const END = START + 60_000

let host: FakeHost

beforeEach(() => {
  host = createFakeHost({ liveSessionIds: [LIVE], coldSessionIds: [COLD] })
  host.addSession(COLD)
})

/** 往会话日志里塞一条事件；seq 由测试自己保证连续。 */
function push(sessionId: string, seq: number, time: number, type = 'turn/start'): void {
  const session = host.sessions.get(sessionId)
  if (session === undefined) throw new Error(`missing session ${sessionId}`)
  session.events.push({ seq, time, type, data: { turn: seq } } as SessionEvent)
}

function window_(extra: { start?: number; end?: number; limit?: number } = {}) {
  return {
    start: extra.start ?? START,
    end: extra.end ?? END,
    ...(extra.limit === undefined ? {} : { limit: extra.limit }),
  }
}

describe('readSessionWindow', () => {
  it('keeps only the events inside the window', async () => {
    push(LIVE, 1, START - 1)
    push(LIVE, 2, START)
    push(LIVE, 3, END)
    push(LIVE, 4, END + 1)

    const result = await readSessionWindow(host.ctx, LIVE, window_())

    expect(result.events.map(event => event.seq)).toEqual([2, 3])
    expect(result.completeness).toBe('full')
    expect(result.reason).toBeUndefined()
  })

  it('reads a cold session from its persisted log', async () => {
    push(COLD, 1, START - 5)
    push(COLD, 2, START + 10)

    const result = await readSessionWindow(host.ctx, COLD, window_())

    // 冷会话没有活 Agent，只能读持久化：窗口内的事件一样要读出来。
    expect(result.events.map(event => event.seq)).toEqual([2])
    expect(result.completeness).toBe('full')
  })

  it('sorts events by seq even when the log arrives out of order', async () => {
    push(LIVE, 3, START + 30)
    push(LIVE, 1, START + 10)
    push(LIVE, 2, START + 20)

    const result = await readSessionWindow(host.ctx, LIVE, window_())

    expect(result.events.map(event => event.seq)).toEqual([1, 2, 3])
  })

  it('keeps the tail and marks the window partial when it exceeds the limit', async () => {
    for (let seq = 1; seq <= 5; seq += 1) push(LIVE, seq, START + seq)

    const result = await readSessionWindow(host.ctx, LIVE, window_({ limit: 2 }))

    expect(result.events.map(event => event.seq)).toEqual([4, 5])
    expect(result.completeness).toBe('partial')
    expect(result.reason).toContain('2')
  })

  it('degrades to unavailable when the session log cannot be read', async () => {
    const result = await readSessionWindow(host.ctx, 'session-missing' as SessionId, window_())

    expect(result.events).toEqual([])
    expect(result.completeness).toBe('unavailable')
    expect(result.reason).toBeTruthy()
  })

  it('caps at the default limit', async () => {
    for (let seq = 1; seq <= 4; seq += 1) push(LIVE, seq, START + seq)

    const result = await readSessionWindow(host.ctx, LIVE, window_())

    expect(SESSION_EVENT_LIMIT).toBeGreaterThan(4)
    expect(result.events).toHaveLength(4)
    expect(result.completeness).toBe('full')
  })
})
