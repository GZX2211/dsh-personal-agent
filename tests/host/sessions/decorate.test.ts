// tests/host/sessions/decorate.test.ts
//
// 角色装饰按会话身份装配：router 得到派发与查询、worker 得到审批；不相关会话
// 不被碰；重复 agent/created 不重复注册；agent 销毁时注册全部卸载。

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ResolverRegistry } from '../../../src/host/approvals/resolvers.ts'
import type { Scheduler } from '../../../src/host/dispatcher/scheduler.ts'
import { createAgentDecorator, roleForSession } from '../../../src/host/sessions/decorate.ts'
import { EventStore } from '../../../src/host/store/event-store.ts'
import { createFakeHost, type FakeHost } from '../../support/fake-host.ts'

const WORKER_TICKET = 't-abcdef1234'
const WORKER_SESSION = 'session-worker'

let directory: string
let store: EventStore
let host: FakeHost
let routerSessionId: string | undefined
let logs: string[]
const scheduler: Scheduler = { trigger: async () => undefined, idle: async () => undefined }

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'pa-decorate-'))
  store = await EventStore.open({ directory })
  host = createFakeHost({
    liveSessionIds: ['session-router', WORKER_SESSION],
    visibleTools: ['pwsh', 'write', 'read', 'present', 'ask_user_question'],
  })
  routerSessionId = 'session-router'
  logs = []
})

afterEach(async () => {
  store.close()
  await rm(directory, { recursive: true, force: true })
})

function seedWorkerTicket(): void {
  store.append({
    type: 'task/queued',
    actor: 'router',
    correlationId: WORKER_TICKET,
    payload: { ticketId: WORKER_TICKET, title: '发布', goal: '发布出去', mode: 'dispatch' },
  })
  store.append({
    type: 'task/dispatched',
    actor: 'system',
    correlationId: WORKER_TICKET,
    payload: { ticketId: WORKER_TICKET, workerSessionId: WORKER_SESSION, mode: 'dispatch' },
  })
}

function makeDecorator(): ReturnType<typeof createAgentDecorator> {
  return createAgentDecorator({
    ctx: host.ctx,
    store,
    scheduler,
    resolvers: new ResolverRegistry(),
    maxWorkers: 5,
    currentRouterSessionId: () => routerSessionId,
    log: message => logs.push(message),
  })
}

function emitCreated(sessionId: string): void {
  const agent = host.sessions.get(sessionId)?.agent
  if (agent === undefined) throw new Error(`missing fake agent ${sessionId}`)
  host.emitEvent('agent/created', { agent, source: 'fresh' })
}

describe('roleForSession', () => {
  it('identifies the router, the worker and nobody else', () => {
    seedWorkerTicket()
    const projection = store.projection()

    expect(roleForSession('session-router', 'session-router', projection)).toBe('router')
    expect(roleForSession(WORKER_SESSION, 'session-router', projection)).toBe('worker')
    expect(roleForSession('session-other', 'session-router', projection)).toBeUndefined()
  })
})

describe('createAgentDecorator', () => {
  it('decorates the router with dispatch, ledger query and restricted tools', () => {
    const decorator = makeDecorator()
    emitCreated('session-router')

    const agent = host.sessions.get('session-router')?.agent
    expect(agent?.sections).toHaveLength(1)
    expect(agent?.sections[0]?.text).toContain('pa_task_route')
    expect(agent?.toolNames).toEqual(['pa_task_route', 'pa_ledger_query'])
    expect(agent?.restrictions).toEqual([
      { deny: ['pwsh', 'write', 'present', 'ask_user_question'] },
    ])
    decorator.dispose()
  })

  it('decorates a worker with the approval tool only', () => {
    seedWorkerTicket()
    const decorator = makeDecorator()
    emitCreated(WORKER_SESSION)

    const agent = host.sessions.get(WORKER_SESSION)?.agent
    expect(agent?.sections[0]?.text).toContain('pa_approval_submit')
    expect(agent?.toolNames).toEqual(['pa_approval_submit'])
    expect(agent?.restrictions).toEqual([{ deny: ['ask_user_question', 'present'] }])
    decorator.dispose()
  })

  it('leaves unrelated sessions untouched', () => {
    const decorator = makeDecorator()
    emitCreated('session-router')
    emitCreated(WORKER_SESSION)

    expect(host.sessions.get(WORKER_SESSION)?.agent.sections).toEqual([])
    expect(host.sessions.get(WORKER_SESSION)?.agent.toolNames).toEqual([])
    decorator.dispose()
  })

  it('is idempotent for repeated agent/created events', () => {
    const decorator = makeDecorator()
    emitCreated('session-router')
    emitCreated('session-router')

    expect(host.sessions.get('session-router')?.agent.toolNames).toHaveLength(2)
    expect(host.sessions.get('session-router')?.agent.sections).toHaveLength(1)
    decorator.dispose()
  })

  it('decorates an existing router agent once its identity is known', () => {
    routerSessionId = undefined
    const decorator = makeDecorator()
    emitCreated('session-router')
    expect(host.sessions.get('session-router')?.agent.sections).toEqual([])

    routerSessionId = 'session-router'
    const agent = host.sessions.get('session-router')?.agent
    if (agent === undefined) throw new Error('missing router agent')
    decorator.decorate(agent as never)

    expect(host.sessions.get('session-router')?.agent.toolNames).toEqual([
      'pa_task_route',
      'pa_ledger_query',
    ])
    decorator.dispose()
  })

  it('releases every registration when the agent is disposed', () => {
    const decorator = makeDecorator()
    emitCreated('session-router')
    const agent = host.sessions.get('session-router')?.agent

    host.emitEvent('agent/disposed', { agent })

    expect(agent?.disposed).toBe(true)
    decorator.dispose()
  })

  it('skips restrictions when none of the candidates are visible', () => {
    host = createFakeHost({ liveSessionIds: ['session-router'], visibleTools: ['read'] })
    const decorator = makeDecorator()
    emitCreated('session-router')

    expect(host.sessions.get('session-router')?.agent.restrictions).toEqual([])
    decorator.dispose()
  })
})
