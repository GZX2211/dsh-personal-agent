// tests/host/perception/delivery.test.ts
//
// 感知投递：消息进入 router 的 inbox，正文只陈述事实，来源坐标随消息一起带上。
// 投递与记账是两件事——这里只验证消息确实进了队列，以及它携带的身份。

import { describe, expect, it } from 'vitest'
import type { SessionId } from '@deepseek-ai/dsh-session'
import { deliverPerceptionNotice, type PerceptionNotice } from '../../../src/host/perception/delivery.ts'
import { deliveredSignalId } from '../../../src/host/signals/identity.ts'
import { createFakeHost } from '../../support/fake-host.ts'

const ROUTER = 'session-router'

function notice(overrides: Partial<PerceptionNotice> = {}): PerceptionNotice {
  return {
    sourceId: 'src-1',
    sourceName: '本地文件',
    threadId: 'changes',
    threadName: '变更',
    externalId: 'a.txt:1732:12',
    statement: 'a.txt 被修改',
    interrupt: false,
    at: 1_700_000_000_000,
    ...overrides,
  }
}

function setup(): {
  host: ReturnType<typeof createFakeHost>
  options: { ctx: ReturnType<typeof createFakeHost>['ctx']; currentRouterSessionId: () => SessionId | undefined }
} {
  const host = createFakeHost({ liveSessionIds: [ROUTER] })
  return {
    host,
    options: { ctx: host.ctx, currentRouterSessionId: () => ROUTER as SessionId },
  }
}

describe('deliverPerceptionNotice', () => {
  it('delivers a notice into the router inbox', async () => {
    const { host, options } = setup()

    const outcome = await deliverPerceptionNotice(options, notice())

    expect(outcome.delivered).toBe(true)
    const delivered = host.sessions.get(ROUTER)?.delivered[0]
    expect(delivered?.text).toContain('[感知事件]')
    expect(delivered?.text).toContain('来源：本地文件 · 变更')
    expect(delivered?.text).toContain('事实：a.txt 被修改')
    expect(delivered?.text).toContain('信号：')
  })

  it('returns the very signal id the observer will derive', async () => {
    const { host, options } = setup()

    const outcome = await deliverPerceptionNotice(options, notice())
    const delivered = host.sessions.get(ROUTER)?.delivered[0]

    expect(outcome.delivered && outcome.signalId).toMatch(/^s-[0-9a-f]{10}$/)
    expect(delivered?.text).toContain(`信号：${outcome.delivered ? outcome.signalId : ''}`)
    expect(deliveredSignalId(ROUTER, delivered?.requestId ?? '')).toBe(
      outcome.delivered ? outcome.signalId : undefined,
    )
  })

  it('carries the source coordinates on the message itself', async () => {
    const { host, options } = setup()

    await deliverPerceptionNotice(options, notice())

    expect(host.sessions.get(ROUTER)?.delivered[0]?.message?.source).toEqual({
      kind: 'dsh-personal-agent/perception',
      form: 'notice',
      sourceId: 'src-1',
      threadId: 'changes',
      sourceName: '本地文件',
      threadName: '变更',
    })
  })

  it('steers instead of queueing when the thread asks to interrupt', async () => {
    const { host, options } = setup()

    await deliverPerceptionNotice(options, notice({ interrupt: true }))

    const delivered = host.sessions.get(ROUTER)?.delivered[0]
    expect(delivered?.steered).toBe(true)
    expect(host.sessions.get(ROUTER)?.agent.inbox.nextStep).toHaveLength(1)
    expect(host.sessions.get(ROUTER)?.agent.inbox.nextTurn).toHaveLength(0)
  })

  it('reports an unavailable router instead of throwing', async () => {
    const { host } = setup()
    const options = { ctx: host.ctx, currentRouterSessionId: () => undefined }

    await expect(deliverPerceptionNotice(options, notice())).resolves.toEqual({
      delivered: false,
      reason: 'router-unavailable',
    })
  })

  it('reports an unavailable router when the session has no live agent', async () => {
    const { host } = setup()
    const options = { ctx: host.ctx, currentRouterSessionId: () => 'session-ghost' as SessionId }

    await expect(deliverPerceptionNotice(options, notice())).resolves.toEqual({
      delivered: false,
      reason: 'router-unavailable',
    })
  })

  it('does not deliver the same fact twice', async () => {
    const { host, options } = setup()

    const first = await deliverPerceptionNotice(options, notice())
    const second = await deliverPerceptionNotice(options, notice())

    expect(first.delivered).toBe(true)
    expect(second).toEqual({ delivered: false, reason: 'already-queued' })
    expect(host.sessions.get(ROUTER)?.delivered).toHaveLength(1)
  })

  it('treats different external facts as different messages', async () => {
    const { host, options } = setup()

    const first = await deliverPerceptionNotice(options, notice({ externalId: 'a.txt:1:1' }))
    const second = await deliverPerceptionNotice(options, notice({ externalId: 'a.txt:2:1' }))

    expect(first.delivered && first.signalId).not.toBe(second.delivered ? second.signalId : undefined)
    expect(host.sessions.get(ROUTER)?.delivered).toHaveLength(2)
  })

  it('stamps the delivery time when the fact carries none', async () => {
    const { host, options } = setup()

    await deliverPerceptionNotice(options, notice({ at: undefined }))

    const text = host.sessions.get(ROUTER)?.delivered[0]?.text ?? ''
    expect(text).toMatch(/时间：\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/)
  })
})
