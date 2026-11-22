// tests/host/tools/pa_ticket_dispatch.test.ts
//
// pa_ticket_dispatch 是 router 唯一的派发入口：它只入队，然后让调度器决定何时放行。
// 失败码必须稳定可路由（invalid-append-target / invalid-directory / invalid-arguments）。

import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { SessionId } from '@deepseek-ai/dsh-session'
import type { ToolRunContext } from '@deepseek-ai/dsh-tools'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createScheduler } from '../../../src/host/dispatcher/scheduler.ts'
import { createClaimRegistry, type ClaimRegistry } from '../../../src/host/signals/claim.ts'
import { EventStore } from '../../../src/host/store/event-store.ts'
import {
  createTicketDispatchTool,
  parseTicketDispatchArgs,
} from '../../../src/host/tools/pa_ticket_dispatch/index.ts'
import { createFakeHost, type FakeHost } from '../../support/fake-host.ts'

const ROUTER_SESSION = 'session-router'

let directory: string
let store: EventStore
let host: FakeHost

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'pa-route-'))
  store = await EventStore.open({ directory })
  host = createFakeHost()
  host.setTurn(ROUTER_SESSION, 1)
})

afterEach(async () => {
  store.close()
  await rm(directory, { recursive: true, force: true })
})

function makeTool(
  maxWorkers: number | (() => number) = 5,
  claims: ClaimRegistry = createClaimRegistry(),
): ReturnType<typeof createTicketDispatchTool> {
  const limit = typeof maxWorkers === 'function' ? maxWorkers : () => maxWorkers
  const scheduler = createScheduler({
    ctx: host.ctx,
    store,
    stateDirectory: directory,
    maxWorkers: limit,
    log: () => undefined,
  })
  return createTicketDispatchTool({ ctx: host.ctx, store, scheduler, maxWorkers: limit, claims })
}

function execution(): ToolRunContext {
  return {
    signal: new AbortController().signal,
    agent: { session: { id: ROUTER_SESSION } },
    callId: 'call-1',
    rootCallId: 'call-1',
    name: 'pa_ticket_dispatch',
    arguments: {},
    token: Symbol('call'),
  } as unknown as ToolRunContext
}

async function run(
  tool: ReturnType<typeof createTicketDispatchTool>,
  args: Record<string, unknown>,
): Promise<{ ticketId: string; status: string; sessionId?: string; queueReason?: string; signalId?: string }> {
  return (await tool.execute(args, execution())) as {
    ticketId: string
    status: string
    sessionId?: string
    queueReason?: string
    signalId?: string
  }
}

/** 让一条信号进入某个回合，就像它刚刚被 router 取用。 */
function deliverSignal(claims: ClaimRegistry, messageId: string, signalId: string, turn: number): void {
  claims.record(messageId, signalId)
  claims.onClaimed(messageId, turn)
}

function decisions(): { action: string; signalId: string; ticketId?: string }[] {
  return store.events().flatMap(event =>
    event.type === 'decision/recorded'
      ? [{ action: event.payload.action, signalId: event.payload.signalId, ticketId: event.payload.ticketId }]
      : [],
  )
}

describe('parseTicketDispatchArgs', () => {
  it('accepts a dispatch request', () => {
    const parsed = parseTicketDispatchArgs({ action: 'dispatch', title: '发布新版本', goal: '把 v2 发出去' })

    expect(parsed).toEqual({
      action: 'dispatch',
      title: '发布新版本',
      goal: '把 v2 发出去',
    })
  })

  it('rejects an append without a target', () => {
    expect(() => parseTicketDispatchArgs({ action: 'append', title: '发布', goal: '发出去' })).toThrow(
      /workerSessionId/,
    )
  })

  it('rejects a title longer than 40 code points', () => {
    expect(() =>
      parseTicketDispatchArgs({ action: 'dispatch', title: '很'.repeat(41), goal: '发出去' }),
    ).toThrow(/40/)
  })

  it('rejects empty required text', () => {
    expect(() => parseTicketDispatchArgs({ action: 'dispatch', title: '  ', goal: '发出去' })).toThrow(/title/)
    expect(() => parseTicketDispatchArgs({ action: 'dispatch', title: '发布', goal: '' })).toThrow(/goal/)
  })

  it('rejects an unknown action', () => {
    expect(() => parseTicketDispatchArgs({ action: 'later', title: '发布', goal: '发' })).toThrow(/action/)
  })
})

describe('pa_ticket_dispatch', () => {
  it('queues a ticket and lets the scheduler dispatch it immediately', async () => {
    const tool = makeTool()

    const result = await run(tool, {
      action: 'dispatch',
      title: '发布新版本',
      goal: '把 v2 发布到生产',
    })

    expect(result.ticketId).toMatch(/^t-[0-9a-f]{10}$/)
    expect(result.status).toBe('running')
    expect(result.sessionId).toMatch(/^session-/)
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
    })
  })

  it('reports a queue reason when no slot is free', async () => {
    const tool = makeTool(0)

    const result = await run(tool, { action: 'dispatch', title: '发布新版本', goal: '发布出去' })

    expect(result).toMatchObject({ status: 'queued', queueReason: 'capacity-full' })
    expect(result.sessionId).toBeUndefined()
    expect(host.createCalls).toBe(0)
  })

  it('applies a lowered limit to later dispatches without touching running work', async () => {
    let limit = 3
    const tool = makeTool(() => limit)
    await run(tool, { action: 'dispatch', title: '第一单', goal: '做完' })
    await run(tool, { action: 'dispatch', title: '第二单', goal: '做完' })
    await run(tool, { action: 'dispatch', title: '第三单', goal: '做完' })

    limit = 1
    const queued = await run(tool, { action: 'dispatch', title: '第四单', goal: '做完' })

    expect(queued).toMatchObject({ status: 'queued', queueReason: 'capacity-full' })
    expect(host.createCalls).toBe(3)
    expect(store.projection().tickets.filter(ticket => ticket.stage === 'running')).toHaveLength(3)
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
    expect(store.events()[0]?.sessionId).toBe(ROUTER_SESSION)
  })

  it('rejects a non-string signal id', () => {
    expect(() =>
      parseTicketDispatchArgs({ action: 'dispatch', title: '发布', goal: '发', signalId: 42 }),
    ).toThrow(/signalId/)
  })
})

/** 一张已经放行、可以继续追加的旧工单。 */
function seedWorkerTicket(workerSessionId: string, ticketId = 't-aaaaaaaaaa'): void {
  store.append({
    type: 'task/queued',
    actor: 'router',
    correlationId: ticketId,
    payload: { ticketId, title: '旧任务', goal: '旧目标', mode: 'dispatch' },
  })
  store.append({
    type: 'task/dispatched',
    actor: 'system',
    correlationId: ticketId,
    payload: { ticketId, workerSessionId, mode: 'dispatch' },
  })
}

describe('signal claiming', () => {
  it('leaves a dispatch unbound when no signal is pending', async () => {
    const tool = makeTool()

    const result = await run(tool, { action: 'dispatch', title: '发布', goal: '发出去' })

    expect(result).not.toHaveProperty('signalId')
    expect(decisions()).toEqual([])
  })

  it('binds the oldest pending signal to a dispatch', async () => {
    const claims = createClaimRegistry()
    deliverSignal(claims, 'msg-1', 's-aaaaaaaaaa', 1)
    const tool = makeTool(5, claims)

    const result = await run(tool, { action: 'dispatch', title: '发布', goal: '发出去' })

    expect(result.signalId).toBe('s-aaaaaaaaaa')
    expect(decisions()).toEqual([
      { action: 'dispatch', signalId: 's-aaaaaaaaaa', ticketId: result.ticketId },
    ])
    const decision = store.events().find(event => event.type === 'decision/recorded')
    expect(decision?.correlationId).toBe('s-aaaaaaaaaa')
  })

  it('binds an append action', async () => {
    seedWorkerTicket('session-1')
    const claims = createClaimRegistry()
    deliverSignal(claims, 'msg-1', 's-bbbbbbbbbb', 1)
    const tool = makeTool(5, claims)

    const result = await run(tool, {
      action: 'append',
      title: '继续发布',
      goal: '接着做',
      workerSessionId: 'session-1',
    })

    expect(result.signalId).toBe('s-bbbbbbbbbb')
    expect(decisions()[0]).toMatchObject({ action: 'append', signalId: 's-bbbbbbbbbb' })
  })

  it('honours an explicit signal id', async () => {
    const claims = createClaimRegistry()
    deliverSignal(claims, 'msg-1', 's-aaaaaaaaaa', 1)
    deliverSignal(claims, 'msg-2', 's-bbbbbbbbbb', 1)
    const tool = makeTool(5, claims)

    const result = await run(tool, {
      action: 'dispatch',
      title: '发布',
      goal: '发出去',
      signalId: 's-bbbbbbbbbb',
    })

    expect(result.signalId).toBe('s-bbbbbbbbbb')
    expect(claims.settle(1)).toEqual(['s-aaaaaaaaaa'])
  })

  it('rejects an explicit signal that this turn cannot claim', async () => {
    const claims = createClaimRegistry()
    deliverSignal(claims, 'msg-1', 's-aaaaaaaaaa', 2)
    const tool = makeTool(5, claims)

    await expect(
      run(tool, { action: 'dispatch', title: '发布', goal: '发出去', signalId: 's-aaaaaaaaaa' }),
    ).rejects.toMatchObject({ code: 'invalid-signal' })
    // 认领在任何账本写入之前：指认无效时不能留下一条没有来源的工单。
    expect(store.events().some(event => event.type === 'task/queued')).toBe(false)
  })

  it('binds one signal per action and leaves the rest pending', async () => {
    const claims = createClaimRegistry()
    deliverSignal(claims, 'msg-1', 's-aaaaaaaaaa', 1)
    const tool = makeTool(5, claims)

    const first = await run(tool, { action: 'dispatch', title: '第一步', goal: '先做完' })
    store.append({
      type: 'task/closed',
      actor: 'system',
      correlationId: first.ticketId,
      payload: { ticketId: first.ticketId, outcome: 'completed' },
    })
    const second = await run(tool, { action: 'dispatch', title: '第二步', goal: '再做' })

    expect(first.signalId).toBe('s-aaaaaaaaaa')
    expect(second).not.toHaveProperty('signalId')
  })

  it('binds nothing before the turn has started in the session', async () => {
    host.setTurn(ROUTER_SESSION, 0)
    const claims = createClaimRegistry()
    deliverSignal(claims, 'msg-1', 's-aaaaaaaaaa', 1)
    const tool = makeTool(5, claims)

    const result = await run(tool, { action: 'dispatch', title: '发布', goal: '发出去' })

    expect(result).not.toHaveProperty('signalId')
    expect(claims.settle(1)).toEqual(['s-aaaaaaaaaa'])
  })

  it('rejects an explicit signal that was already claimed', async () => {
    const claims = createClaimRegistry()
    deliverSignal(claims, 'msg-1', 's-aaaaaaaaaa', 1)
    claims.claim(1, 's-aaaaaaaaaa')
    const tool = makeTool(5, claims)

    await expect(
      run(tool, { action: 'dispatch', title: '发布', goal: '发出去', signalId: 's-aaaaaaaaaa' }),
    ).rejects.toMatchObject({ code: 'invalid-signal' })
    expect(store.events().some(event => event.type === 'task/queued')).toBe(false)
  })

  it('rejects an explicit signal before any turn exists', async () => {
    host.setTurn(ROUTER_SESSION, 0)
    const claims = createClaimRegistry()
    deliverSignal(claims, 'msg-1', 's-aaaaaaaaaa', 1)
    const tool = makeTool(5, claims)

    await expect(
      run(tool, { action: 'dispatch', title: '发布', goal: '发出去', signalId: 's-aaaaaaaaaa' }),
    ).rejects.toMatchObject({ code: 'invalid-signal' })
    // 指认失败不消耗信号：它仍然属于它原来的回合。
    expect(claims.settle(1)).toEqual(['s-aaaaaaaaaa'])
  })
})
