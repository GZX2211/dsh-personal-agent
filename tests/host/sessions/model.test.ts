// tests/host/sessions/model.test.ts
//
// 执行器模型只播种一次：新 worker 在第一个请求前写入选中的 route，并让首个
// 请求使用它；请求一旦落头，后续不再覆盖。已有选择的会话不重复播种。

import { describe, expect, it } from 'vitest'
import { seedWorkerModel } from '../../../src/host/sessions/model.ts'
import { createFakeHost, type FakeAgent } from '../../support/fake-host.ts'

const WORKER = 'session-worker'

function setup(services?: Record<string, unknown>): { host: ReturnType<typeof createFakeHost>; agent: FakeAgent } {
  const host = createFakeHost({ liveSessionIds: [WORKER], ...(services === undefined ? {} : { services }) })
  const agent = host.sessions.get(WORKER)?.agent
  if (agent === undefined) throw new Error('fake host did not create the worker agent')
  return { host, agent }
}

function requestListener(agent: FakeAgent): (payload: unknown, next: () => Promise<unknown>) => Promise<unknown> {
  const listener = agent.listeners.get('agent/request')?.[0]
  if (listener === undefined) throw new Error('no agent/request listener was registered')
  return listener as (payload: unknown, next: () => Promise<unknown>) => Promise<unknown>
}

describe('seedWorkerModel', () => {
  it('does nothing when the executor inherits the host default', async () => {
    const { host, agent } = setup()

    expect(await seedWorkerModel(host.ctx, agent as never, null)).toBe(false)
    expect(agent.session.appended).toEqual([])
    expect(agent.listeners.has('agent/request')).toBe(false)
  })

  it('writes the resolved selection and pins it on the first request only', async () => {
    const { host, agent } = setup()
    const resolve = async () => ({
      provider: 'deepseek-official',
      model: 'deepseek-flash',
      reasoningEffort: 'high',
    })

    const seeded = await seedWorkerModel(
      host.ctx,
      agent as never,
      { provider: 'deepseek-official', model: 'deepseek-flash' },
      { resolve },
    )

    expect(seeded).toBe(true)
    expect(agent.session.appended).toEqual([
      {
        type: 'model/selection',
        data: { provider: 'deepseek-official', model: 'deepseek-flash', reasoningEffort: 'high' },
      },
    ])

    const listener = requestListener(agent)
    const first = await listener({}, async () => ({ provider: 'dsh-default', model: 'default', maxTokens: 100 }))
    expect(first).toEqual({
      provider: 'deepseek-official',
      model: 'deepseek-flash',
      reasoningEffort: 'high',
      maxTokens: 100,
    })

    // 请求落头后，选择已由会话记录接管，后续请求不再被覆盖。
    host.emitSessionEvent(WORKER, { type: 'request/header', data: {} })
    const second = await listener({}, async () => ({ provider: 'dsh-default', model: 'default' }))
    expect(second).toEqual({ provider: 'dsh-default', model: 'default' })
  })

  it('leaves a session that already recorded a model selection alone', async () => {
    const { host, agent } = setup()
    agent.session.appended.push({ type: 'model/selection', data: { provider: 'p', model: 'm' } })
    agent.session.snapshotEvents = () => [{ type: 'model/selection' }]

    expect(
      await seedWorkerModel(host.ctx, agent as never, { provider: 'p', model: 'm' }),
    ).toBe(false)
    expect(agent.session.appended).toHaveLength(1)
  })

  it('leaves a session that already sent a request alone', async () => {
    const { host, agent } = setup()
    agent.session.header = { config: { provider: 'p', model: 'm' } }

    expect(
      await seedWorkerModel(host.ctx, agent as never, { provider: 'p', model: 'm' }),
    ).toBe(false)
  })

  it('resolves through the host LLM service by default', async () => {
    const resolveCallConfig = async (config: { provider: string; model: string; reasoningEffort?: string }) => ({
      ...config,
      reasoningEffort: 'low',
    })
    const { host, agent } = setup({ llm: { resolveCallConfig } })

    await seedWorkerModel(host.ctx, agent as never, { provider: 'p', model: 'm' })

    expect(agent.session.appended).toEqual([
      { type: 'model/selection', data: { provider: 'p', model: 'm', reasoningEffort: 'low' } },
    ])
  })

  it('fails loudly when the host has no LLM service', async () => {
    const { host, agent } = setup()

    await expect(seedWorkerModel(host.ctx, agent as never, { provider: 'p', model: 'm' })).rejects.toThrow(
      /LLM/,
    )
  })
})
