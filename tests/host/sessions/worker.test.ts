// tests/host/sessions/worker.test.ts
//
// 执行会话的创建：工作区根目录来自执行器设置，工单目录仍在根目录下隔离；
// 配置了执行器模型时只给新会话播种，模型不可用不能拦住放行。

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createWorkerSession } from '../../../src/host/sessions/worker.ts'
import { createFakeHost, type FakeHost } from '../../support/fake-host.ts'

let directory: string
let host: FakeHost

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'pa-worker-'))
  host = createFakeHost()
})

afterEach(async () => {
  await rm(directory, { recursive: true, force: true })
})

describe('createWorkerSession', () => {
  it('creates the workspace and ticket directory under the configured root', async () => {
    const root = join(directory, 'custom-root')

    const worker = await createWorkerSession(host.ctx, root, { ticketId: 't-1', title: '发布' })

    expect(worker.directory).toBe(join(root, 't-1'))
    expect(host.workspaces[0]?.path).toBe(root)
    expect(host.sessions.get(worker.sessionId)?.cwd).toBe(join(root, 't-1'))
  })

  it('honours an explicit ticket directory', async () => {
    const root = join(directory, 'custom-root')
    const explicit = join(directory, 'elsewhere')

    const worker = await createWorkerSession(host.ctx, root, {
      ticketId: 't-2',
      title: '发布',
      directory: explicit,
    })

    expect(worker.directory).toBe(explicit)
  })

  it('seeds the configured model on the new agent', async () => {
    const resolveCallConfig = async (config: { provider: string; model: string }) => config
    host = createFakeHost({ services: { llm: { resolveCallConfig } } })
    const root = join(directory, 'work')

    const worker = await createWorkerSession(host.ctx, root, {
      ticketId: 't-3',
      title: '发布',
      model: { provider: 'deepseek-official', model: 'deepseek-flash' },
    })

    const agent = host.sessions.get(worker.sessionId)?.agent
    expect(agent?.session.appended).toEqual([
      { type: 'model/selection', data: { provider: 'deepseek-official', model: 'deepseek-flash' } },
    ])
  })

  it('keeps the worker when the model cannot be resolved', async () => {
    const root = join(directory, 'work')
    const logs: string[] = []

    const worker = await createWorkerSession(host.ctx, root, {
      ticketId: 't-4',
      title: '发布',
      model: { provider: 'ghost', model: 'missing' },
      log: message => logs.push(message),
    })

    const agent = host.sessions.get(worker.sessionId)?.agent
    expect(worker.sessionId).toBe('session-1')
    expect(agent?.session.appended).toEqual([])
    expect(logs[0]).toContain('keeps the default model')
    expect(host.sessions.get(worker.sessionId)?.cwd).toBe(join(root, 't-4'))
  })
})
