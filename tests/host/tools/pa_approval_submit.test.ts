// tests/host/tools/pa_approval_submit.test.ts
//
// 审批工具的核心契约：写 pending → 阻塞 → 收到决定并确认 → 返回决定；
// 回合中止时审批留在账本里，工具以 approval-cancelled 结束。

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ToolRunContext } from '@deepseek-ai/dsh-tools'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ResolverRegistry } from '../../../src/host/approvals/resolvers.ts'
import { EventStore } from '../../../src/host/store/event-store.ts'
import {
  createApprovalSubmitTool,
  type ApprovalSubmitArgs,
} from '../../../src/host/tools/pa_approval_submit/index.ts'
import { createFakeHost, type FakeHost } from '../../support/fake-host.ts'

const TICKET_ID = 't-abcdef1234'
const WORKER_SESSION = 'session-1'

let directory: string
let store: EventStore
let host: FakeHost
let resolvers: ResolverRegistry

const BASE_ARGS: ApprovalSubmitArgs = {
  title: '要发布吗',
  question: '发布到生产会立刻影响用户。',
  options: [
    { label: '发布', description: '立刻上线' },
    { label: '等等', description: '继续观察' },
  ],
}

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'pa-approval-'))
  store = await EventStore.open({ directory })
  host = createFakeHost({ liveSessionIds: [WORKER_SESSION] })
  resolvers = new ResolverRegistry()
})

afterEach(async () => {
  store.close()
  await rm(directory, { recursive: true, force: true })
})

function makeTool(): ReturnType<typeof createApprovalSubmitTool> {
  return createApprovalSubmitTool({ ctx: host.ctx, store, resolvers })
}

function execution(signal: AbortSignal, sessionId = WORKER_SESSION): ToolRunContext {
  return {
    signal,
    agent: { session: { id: sessionId } },
    callId: 'call-1',
    rootCallId: 'call-1',
    name: 'pa_approval_submit',
    arguments: {},
    token: Symbol('call'),
  } as unknown as ToolRunContext
}

function seedRunningTicket(): void {
  store.append({
    type: 'task/queued',
    actor: 'router',
    correlationId: TICKET_ID,
    payload: { ticketId: TICKET_ID, title: '发布新版本', goal: '把 v2 发布到生产', mode: 'dispatch' },
  })
  store.append({
    type: 'task/dispatched',
    actor: 'system',
    correlationId: TICKET_ID,
    payload: { ticketId: TICKET_ID, workerSessionId: WORKER_SESSION, mode: 'dispatch' },
  })
}

async function waitForPending(): Promise<string> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const event = store.events().find(item => item.type === 'approval/pending')
    if (event !== undefined) return event.payload.approvalId
    await new Promise(resolve => setTimeout(resolve, 5))
  }
  throw new Error('approval/pending was never written')
}

describe('pa_approval_submit', () => {
  it('blocks until a decision is delivered and returns it', async () => {
    seedRunningTicket()
    const tool = makeTool()
    const controller = new AbortController()

    const pending = tool.execute(BASE_ARGS, execution(controller.signal)) as Promise<Record<string, unknown>>
    const approvalId = await waitForPending()
    const resolver = resolvers.find(approvalId)
    expect(resolver).toBeDefined()

    await resolver?.deliver({
      decision: { kind: 'selected', index: 1, label: '等等', note: '先别发', fields: { window: '今晚' } },
      decidedAt: 1_700_000_000_000,
    })
    const result = await pending

    expect(result).toEqual({
      approvalId,
      decision: { kind: 'selected', index: 1, label: '等等' },
      note: '先别发',
      fields: { window: '今晚' },
      decidedAt: 1_700_000_000_000,
    })
    expect(resolvers.find(approvalId)).toBeUndefined()
    expect(store.events().filter(event => event.type === 'approval/pending')).toHaveLength(1)
  })

  it('writes the submitted question with options, fields and risk', async () => {
    seedRunningTicket()
    const tool = makeTool()
    const controller = new AbortController()

    const pending = tool.execute(
      {
        ...BASE_ARGS,
        risk: 'high',
        fields: [{ key: 'window', label: '发布时间', type: 'text', required: true }],
      },
      execution(controller.signal),
    ) as Promise<Record<string, unknown>>
    const approvalId = await waitForPending()
    const payload = store.events().find(event => event.type === 'approval/pending')?.payload

    expect(payload).toMatchObject({
      approvalId,
      ticketId: TICKET_ID,
      title: '要发布吗',
      question: '发布到生产会立刻影响用户。',
      options: BASE_ARGS.options,
      fields: [{ key: 'window', label: '发布时间', type: 'text', required: true }],
      risk: 'high',
      requestedBySessionId: WORKER_SESSION,
    })

    controller.abort()
    await expect(pending).rejects.toMatchObject({ code: 'approval-cancelled' })
  })

  it('returns a skipped decision', async () => {
    seedRunningTicket()
    const tool = makeTool()
    const controller = new AbortController()

    const pending = tool.execute(BASE_ARGS, execution(controller.signal)) as Promise<Record<string, unknown>>
    const approvalId = await waitForPending()

    await resolvers.find(approvalId)?.deliver({ decision: { kind: 'skipped' }, decidedAt: 5 })

    await expect(pending).resolves.toEqual({
      approvalId,
      decision: { kind: 'skipped' },
      decidedAt: 5,
    })
  })

  it('ends with approval-cancelled when the turn is aborted and keeps the approval pending', async () => {
    seedRunningTicket()
    const tool = makeTool()
    const controller = new AbortController()

    const pending = tool.execute(BASE_ARGS, execution(controller.signal)) as Promise<Record<string, unknown>>
    const approvalId = await waitForPending()
    controller.abort()

    await expect(pending).rejects.toMatchObject({ code: 'approval-cancelled' })
    expect(resolvers.find(approvalId)).toBeUndefined()
    expect(store.events().filter(event => event.type === 'approval/pending')).toHaveLength(1)
    expect(store.projection().approvals).toEqual([expect.objectContaining({ id: approvalId })])
  })

  it('rejects when the calling session has no active ticket', async () => {
    const tool = makeTool()

    await expect(
      tool.execute(BASE_ARGS, execution(new AbortController().signal, 'session-other')),
    ).rejects.toMatchObject({ code: 'no-active-ticket' })
    expect(store.events()).toEqual([])
  })

  it('rejects a ticket id that is not bound to the calling session', async () => {
    seedRunningTicket()
    const tool = makeTool()

    await expect(
      tool.execute(
        { ...BASE_ARGS, ticketId: 't-1111111111' },
        execution(new AbortController().signal),
      ),
    ).rejects.toMatchObject({ code: 'no-active-ticket' })
  })

  it('rejects malformed options before writing anything', async () => {
    seedRunningTicket()
    const tool = makeTool()

    await expect(
      tool.execute(
        { ...BASE_ARGS, options: [{ label: '发布', description: '上线' }] },
        execution(new AbortController().signal),
      ),
    ).rejects.toMatchObject({ code: 'invalid-options' })
    await expect(
      tool.execute(
        {
          ...BASE_ARGS,
          options: [
            { label: '一', description: '1' },
            { label: '二', description: '2' },
            { label: '三', description: '3' },
            { label: '四', description: '4' },
            { label: '五', description: '5' },
          ],
        },
        execution(new AbortController().signal),
      ),
    ).rejects.toMatchObject({ code: 'invalid-options' })
    await expect(
      tool.execute(
        { ...BASE_ARGS, options: [{ label: '  ', description: '上线' }, BASE_ARGS.options[1]] },
        execution(new AbortController().signal),
      ),
    ).rejects.toMatchObject({ code: 'invalid-arguments' })
    expect(store.events().filter(event => event.type === 'approval/pending')).toEqual([])
  })

  it('rejects duplicate field keys and unknown field types', async () => {
    seedRunningTicket()
    const tool = makeTool()
    const signal = new AbortController().signal

    await expect(
      tool.execute(
        {
          ...BASE_ARGS,
          fields: [
            { key: 'window', label: '时间', type: 'text' },
            { key: 'window', label: '重复', type: 'text' },
          ],
        },
        execution(signal),
      ),
    ).rejects.toMatchObject({ code: 'invalid-arguments' })
    await expect(
      tool.execute(
        { ...BASE_ARGS, fields: [{ key: 'window', label: '时间', type: 'date' }] },
        execution(signal),
      ),
    ).rejects.toMatchObject({ code: 'invalid-arguments' })
  })
})
