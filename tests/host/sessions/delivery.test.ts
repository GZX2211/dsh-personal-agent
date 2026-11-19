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
})
