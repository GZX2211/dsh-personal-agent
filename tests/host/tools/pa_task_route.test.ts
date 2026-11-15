// tests/host/tools/pa_task_route.test.ts
//
// pa_task_route 是 router 唯一的派发入口：它只入队，然后让调度器决定何时放行。
// 失败码必须稳定可路由（invalid-append-target / invalid-directory / invalid-arguments）。

import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { SessionId } from '@deepseek-ai/dsh-session'
import type { ToolRunContext } from '@deepseek-ai/dsh-tools'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createScheduler } from '../../../src/host/dispatcher/scheduler.ts'
import { EventStore } from '../../../src/host/store/event-store.ts'
import {
  createTaskRouteTool,
  parseTaskRouteArgs,
} from '../../../src/host/tools/pa_task_route/index.ts'
import { createFakeHost, type FakeHost } from '../../support/fake-host.ts'

let directory: string
let store: EventStore
let host: FakeHost

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'pa-route-'))
  store = await EventStore.open({ directory })
  host = createFakeHost()
})

afterEach(async () => {
  store.close()
  await rm(directory, { recursive: true, force: true })
})

function makeTool(maxWorkers = 5): ReturnType<typeof createTaskRouteTool> {
  const scheduler = createScheduler({
    ctx: host.ctx,
    store,
    stateDirectory: directory,
    maxWorkers,
    log: () => undefined,
  })
  return createTaskRouteTool({ ctx: host.ctx, store, scheduler, maxWorkers })
}

function execution(): ToolRunContext {
  return {
    signal: new AbortController().signal,
    agent: { session: { id: 'session-router' } },
    callId: 'call-1',
    rootCallId: 'call-1',
    name: 'pa_task_route',
    arguments: {},
    token: Symbol('call'),
  } as unknown as ToolRunContext
}

async function run(
  tool: ReturnType<typeof createTaskRouteTool>,
  args: Record<string, unknown>,
): Promise<{ ticketId: string; status: string; sessionId?: string; queueReason?: string }> {
  return (await tool.execute(args, execution())) as {
    ticketId: string
    status: string
    sessionId?: string
    queueReason?: string
  }
}

describe('parseTaskRouteArgs', () => {
  it('accepts a dispatch request', () => {
    const parsed = parseTaskRouteArgs({ action: 'dispatch', title: '发布新版本', goal: '把 v2 发出去' })

    expect(parsed).toEqual({
      action: 'dispatch',
      title: '发布新版本',
      goal: '把 v2 发出去',
    })
  })

  it('rejects an append without a target', () => {
    expect(() => parseTaskRouteArgs({ action: 'append', title: '发布', goal: '发出去' })).toThrow(
      /workerSessionId/,
    )
  })

  it('rejects a title longer than 40 code points', () => {
    expect(() =>
      parseTaskRouteArgs({ action: 'dispatch', title: '很'.repeat(41), goal: '发出去' }),
    ).toThrow(/40/)
  })

  it('rejects empty required text', () => {
    expect(() => parseTaskRouteArgs({ action: 'dispatch', title: '  ', goal: '发出去' })).toThrow(/title/)
    expect(() => parseTaskRouteArgs({ action: 'dispatch', title: '发布', goal: '' })).toThrow(/goal/)
  })

  it('rejects unknown actions and bad constraint lists', () => {
    expect(() => parseTaskRouteArgs({ action: 'later', title: '发布', goal: '发' })).toThrow(/action/)
    expect(() =>
      parseTaskRouteArgs({ action: 'dispatch', title: '发布', goal: '发', constraints: [1] }),
    ).toThrow(/constraints/)
  })
})

describe('pa_task_route', () => {
  it('queues a ticket and lets the scheduler dispatch it immediately', async () => {
    const tool = makeTool()

    const result = await run(tool, {
      action: 'dispatch',
      title: '发布新版本',
      goal: '把 v2 发布到生产',
      context: '用户原话：今晚发',
      constraints: ['不要动数据库'],
      expectedOutput: '返回 200',
    })

    expect(result.ticketId).toMatch(/^t-[0-9a-f]{10}$/)
    expect(result.status).toBe('running')
    expect(result.sessionId).toBeDefined()
    expect(store.projection().tickets[0]).toMatchObject({
      id: result.ticketId,
      stage: 'running',
      title: '发布新版本',
      workerSessionId: result.sessionId,
    })
    const queued = store.events().find(event => event.type === 'task/queued')
    expect(queued?.payload).toMatchObject({
      mode: 'dispatch',
      requestedBySessionId: 'session-router',
      constraints: ['不要动数据库'],
    })
  })

  it('reports a queue reason when no slot is free', async () => {
    const tool = makeTool(0)

    const result = await run(tool, { action: 'dispatch', title: '发布新版本', goal: '发布出去' })

    expect(result).toMatchObject({ status: 'queued', queueReason: 'capacity-full' })
    expect(result.sessionId).toBeUndefined()
    expect(host.createCalls).toBe(0)
  })

  it('rejects an append to an unknown worker session', async () => {
    const tool = makeTool()

    await expect(
      run(tool, {
        action: 'append',
        title: '继续发布',
        goal: '接着做',
        workerSessionId: 'session-ghost',
      }),
    ).rejects.toMatchObject({ code: 'invalid-append-target' })
  })

  it('rejects an append to an archived worker session', async () => {
    const tool = makeTool()
    store.append({
      type: 'task/queued',
      actor: 'router',
      correlationId: 't-abcdef1234',
      payload: { ticketId: 't-abcdef1234', title: '旧任务', goal: '旧目标', mode: 'dispatch' },
    })
    store.append({
      type: 'task/dispatched',
      actor: 'system',
      correlationId: 't-abcdef1234',
      payload: { ticketId: 't-abcdef1234', workerSessionId: 'session-1', mode: 'dispatch' },
    })
    host.archivedSessionIds.push('session-1')

    await expect(
      run(tool, {
        action: 'append',
        title: '继续发布',
        goal: '接着做',
        workerSessionId: 'session-1',
      }),
    ).rejects.toMatchObject({ code: 'invalid-append-target' })
  })

  it('appends to an idle worker without creating a session', async () => {
    const tool = makeTool()
    const first = await run(tool, { action: 'dispatch', title: '第一步', goal: '先做完' })
    store.append({
      type: 'task/closed',
      actor: 'system',
      correlationId: first.ticketId,
      payload: { ticketId: first.ticketId, outcome: 'completed' },
    })
    const workerSessionId = first.sessionId

    const second = await run(tool, {
      action: 'append',
      title: '第二步',
      goal: '接着做',
      workerSessionId,
    })

    expect(second).toMatchObject({ status: 'running', sessionId: workerSessionId })
    expect(host.createCalls).toBe(1)
  })

  it('reports worker-busy when appending to a busy worker', async () => {
    const tool = makeTool()
    const first = await run(tool, { action: 'dispatch', title: '第一步', goal: '先做完' })

    const second = await run(tool, {
      action: 'append',
      title: '第二步',
      goal: '接着做',
      workerSessionId: first.sessionId,
    })

    expect(second).toMatchObject({ status: 'queued', queueReason: 'worker-busy' })
    expect(host.createCalls).toBe(1)
  })

  it('rejects a relative or missing working directory', async () => {
    const tool = makeTool()

    await expect(
      run(tool, { action: 'dispatch', title: '发布', goal: '发出去', cwd: 'relative/dir' }),
    ).rejects.toMatchObject({ code: 'invalid-directory' })
    await expect(
      run(tool, { action: 'dispatch', title: '发布', goal: '发出去', cwd: join(directory, 'missing') }),
    ).rejects.toMatchObject({ code: 'invalid-directory' })
  })

  it('keeps an existing absolute working directory', async () => {
    const target = join(directory, 'workspace')
    await mkdir(target)
    const tool = makeTool()

    const result = await run(tool, { action: 'dispatch', title: '发布', goal: '发出去', cwd: target })

    expect(store.projection().tickets[0]?.directory).toBe(target)
    expect(result.status).toBe('running')
  })

  it('uses the ticket id as correlation and the calling session as requester', async () => {
    const tool = makeTool()

    const result = await run(tool, { action: 'dispatch', title: '发布', goal: '发出去' })

    expect(store.events()[0]?.correlationId).toBe(result.ticketId)
    expect(store.events()[0]?.sessionId).toBe('session-router')
  })
})
