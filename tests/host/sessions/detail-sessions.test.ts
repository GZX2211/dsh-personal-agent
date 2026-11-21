// tests/host/sessions/detail-sessions.test.ts
//
// 详情页要读哪些会话：负责人 + 它登记过的子代理（递归）+ 在本单投递过消息的会话。
// 上限保护一次轮询的读取量：跨单协作的深树不该让详情页读半本日志。

import type { SessionEvent, SessionId } from '@deepseek-ai/dsh-session'
import { beforeEach, describe, expect, it } from 'vitest'
import { readDetailSessions } from '../../../src/host/sessions/detail-sessions.ts'
import { createFakeHost, type FakeHost } from '../../support/fake-host.ts'

const ROOT = 'session-worker' as SessionId
const A = 'session-a' as SessionId
const B = 'session-b' as SessionId
const A1 = 'session-a1' as SessionId
const X = 'session-x' as SessionId
const START = 1_700_000_000_000
const END = START + 60_000

let host: FakeHost

beforeEach(() => {
  host = createFakeHost({ liveSessionIds: [ROOT, A, B, A1, X] })
})

function catalog(parent: SessionId, child: SessionId): void {
  push(parent, 'subagent/catalog', START + 1, {
    version: 3,
    childId: child,
    childCreatedAt: START + 2,
    mode: 'continuable',
    name: child,
  })
}

function agentMessage(to: SessionId, from: SessionId): void {
  push(to, 'user/message', START + 10, {
    id: `msg-${from}`,
    role: 'user',
    content: [{ type: 'text', text: `来自 ${from} 的消息` }],
    source: { kind: 'agent-message', form: 'relay', senderSessionId: from },
  })
}

function push(sessionId: SessionId, type: string, time: number, data: Record<string, unknown>): void {
  const session = host.sessions.get(sessionId)
  if (session === undefined) throw new Error(`missing session ${sessionId}`)
  session.events.push({ seq: session.events.length + 1, time, type, data } as SessionEvent)
}

function window_(extra: { limit?: number } = {}) {
  return { start: START, end: END, ...extra }
}

describe('readDetailSessions', () => {
  it('reads the root and the subagents it registered, recursively', async () => {
    catalog(ROOT, A)
    catalog(ROOT, B)
    catalog(A, A1)

    const sessions = await readDetailSessions(host.ctx, ROOT, window_())

    expect([...sessions.keys()]).toEqual([ROOT, A, B, A1])
    expect(sessions.get(ROOT)?.completeness).toBe('full')
  })

  it('follows a sender that is not in the catalog', async () => {
    agentMessage(ROOT, X)

    const sessions = await readDetailSessions(host.ctx, ROOT, window_())

    // 跨单复用的会话不在 catalog 里，但它在窗口内投递过，仍要读出来。
    expect([...sessions.keys()]).toEqual([ROOT, X])
  })

  it('stops at the session limit', async () => {
    catalog(ROOT, A)
    catalog(ROOT, B)
    catalog(ROOT, A1)
    catalog(ROOT, X)

    const sessions = await readDetailSessions(host.ctx, ROOT, window_({ limit: 2 }))

    expect(sessions.size).toBe(2)
  })

  it('returns nothing when the ticket has no worker yet', async () => {
    const sessions = await readDetailSessions(host.ctx, undefined, window_())

    expect(sessions.size).toBe(0)
  })

  it('keeps an unreadable session as unavailable instead of failing the page', async () => {
    catalog(ROOT, 'session-gone' as SessionId)

    const sessions = await readDetailSessions(host.ctx, ROOT, window_())

    expect(sessions.get('session-gone' as SessionId)).toMatchObject({
      completeness: 'unavailable',
      events: [],
    })
  })
})
