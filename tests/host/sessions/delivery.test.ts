// tests/host/sessions/delivery.test.ts
//
// 投递的幂等边界：同一 requestId 在本进程只投一次；目标会话没有活 Agent 时
// 抛可辨认的失败，让调用方按分支处理。

import type { SessionId } from '@deepseek-ai/dsh-session'
import { beforeEach, describe, expect, it } from 'vitest'
import { deliverToSession } from '../../../src/host/sessions/delivery.ts'
import { createFakeHost, type FakeHost } from '../../support/fake-host.ts'

const SESSION = 'session-1' as SessionId

let host: FakeHost

beforeEach(() => {
  host = createFakeHost({ liveSessionIds: [SESSION] })
})

describe('deliverToSession', () => {
  it('delivers a request id only once', async () => {
    const first = await deliverToSession(host.ctx, SESSION, { requestId: 'r-1', text: '任务简报' })
    const second = await deliverToSession(host.ctx, SESSION, { requestId: 'r-1', text: '任务简报' })

    expect(first).toBe('delivered')
    expect(second).toBe('already-queued')
    expect(host.sessions.get(SESSION)?.delivered).toEqual([
      expect.objectContaining({ requestId: 'pa-delivery:r-1', text: '任务简报' }),
    ])
  })

  it('delivers different request ids independently', async () => {
    await deliverToSession(host.ctx, SESSION, { requestId: 'r-1', text: '第一份' })
    const second = await deliverToSession(host.ctx, SESSION, { requestId: 'r-2', text: '第二份' })

    expect(second).toBe('delivered')
    expect(host.sessions.get(SESSION)?.delivered.map(item => item.requestId)).toEqual([
      'pa-delivery:r-1',
      'pa-delivery:r-2',
    ])
  })

  it('fails with a stable code when the target session has no live agent', async () => {
    await expect(
      deliverToSession(host.ctx, 'session-missing' as SessionId, { requestId: 'r-3', text: '简报' }),
    ).rejects.toMatchObject({ code: 'session-not-live' })
  })

  it('steers into the current turn instead of starting a follow-up', async () => {
    const outcome = await deliverToSession(host.ctx, SESSION, {
      requestId: 'r-steer',
      text: '契约改了，按新字段实现',
      target: 'steer',
    })

    const session = host.sessions.get(SESSION)
    expect(outcome).toBe('delivered')
    expect(session?.delivered).toEqual([
      expect.objectContaining({ requestId: 'pa-delivery:r-steer', steered: true }),
    ])
    expect(session?.agent.inbox.nextStep).toHaveLength(1)
    expect(session?.agent.inbox.nextTurn).toEqual([])
  })

  it('keeps follow-up as the default target', async () => {
    await deliverToSession(host.ctx, SESSION, { requestId: 'r-followup', text: '任务简报' })

    const session = host.sessions.get(SESSION)
    expect(session?.delivered[0]?.steered).toBeUndefined()
    expect(session?.agent.inbox.nextTurn).toHaveLength(1)
    expect(session?.agent.inbox.nextStep).toEqual([])
  })

  it('treats a pending steer as the same delivery', async () => {
    await deliverToSession(host.ctx, SESSION, { requestId: 'r-1', text: '补充', target: 'steer' })
    const second = await deliverToSession(host.ctx, SESSION, { requestId: 'r-1', text: '补充' })

    expect(second).toBe('already-queued')
    expect(host.sessions.get(SESSION)?.delivered).toHaveLength(1)
  })
})
