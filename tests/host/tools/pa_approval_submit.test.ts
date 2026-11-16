// tests/host/tools/pa_approval_submit.test.ts
//
// 审批工具的核心契约：写 pending → 阻塞 → 收到决定并确认 → 返回决定；
// 回合中止时审批留在账本里，工具以 approval-cancelled 结束。
// 审批不依赖工单：没有进行中工单时仍提交，只是不绑定 ticketId。

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ToolRunContext } from '@deepseek-ai/dsh-tools'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ResolverRegistry } from '../../../src/host/approvals/resolvers.ts'
import { EventStore } from '../../../src/host/store/event-store.ts'
import {
  createApprovalSubmitTool,
  MAX_ATTACHMENTS,
  resolveAttachments,
  type ApprovalSubmitArgs,
} from '../../../src/host/tools/pa_approval_submit/index.ts'
import { createFakeHost, type FakeHost } from '../../support/fake-host.ts'

const TICKET_ID = 't-abcdef1234'
const WORKER_SESSION = 'session-1'
const WORK_DIRECTORY = join('D:\\', 'pa-work', TICKET_ID)

let directory: string
let store: EventStore
let host: FakeHost
let resolvers: ResolverRegistry

const BASE_ARGS: ApprovalSubmitArgs = {
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

function seedRunningTicket(ticketDirectory?: string): void {
  store.append({
    type: 'task/queued',
    actor: 'router',
    correlationId: TICKET_ID,
    payload: {
      ticketId: TICKET_ID,
      title: '发布新版本',
      goal: '把 v2 发布到生产',
      mode: 'dispatch',
      ...(ticketDirectory === undefined ? {} : { directory: ticketDirectory }),
    },
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

function pendingPayload(): Record<string, unknown> {
  const event = store.events().find(item => item.type === 'approval/pending')
  if (event === undefined) throw new Error('approval/pending was never written')
  return event.payload as unknown as Record<string, unknown>
}

describe('resolveAttachments', () => {
  it('returns nothing when the worker sent no attachments', () => {
    expect(resolveAttachments(undefined, WORK_DIRECTORY)).toEqual([])
    expect(resolveAttachments([], WORK_DIRECTORY)).toEqual([])
  })

  it('resolves parent segments and keeps absolute paths untouched', () => {
    expect(resolveAttachments(['../outside.md'], WORK_DIRECTORY)).toEqual([
      join(WORK_DIRECTORY, '..', 'outside.md'),
    ])
    expect(resolveAttachments(['/tmp/abs.md'], WORK_DIRECTORY)).toEqual(['/tmp/abs.md'])
  })

  it('accepts a full attachment list', () => {
    const paths = Array.from({ length: MAX_ATTACHMENTS }, (_, index) => join(WORK_DIRECTORY, `${index}.md`))

    expect(resolveAttachments(paths, WORK_DIRECTORY)).toHaveLength(MAX_ATTACHMENTS)
  })
})

describe('pa_approval_submit', () => {
  it('blocks until a decision is delivered and returns it', async () => {
    seedRunningTicket()
    const tool = makeTool()
    const controller = new AbortController()

    const pending = tool.execute(BASE_ARGS, execution(controller.signal)) as Promise<Record<string, unknown>>
    const approvalId = await waitForPending()
    const resolver = resolvers.find(approvalId)
    if (resolver === undefined) throw new Error('resolver was not registered')
    expect(resolver.approvalId).toBe(approvalId)

    await resolver?.deliver({
      decision: { kind: 'selected', index: 1, label: '等等', answer: '先别发' },
      decidedAt: 1_700_000_000_000,
    })
    const result = await pending

    expect(result).toEqual({
      approvalId,
      decision: { kind: 'selected', index: 1, label: '等等', answer: '先别发' },
      decidedAt: 1_700_000_000_000,
    })
    expect(resolvers.find(approvalId)).toBeUndefined()
    expect(store.events().filter(event => event.type === 'approval/pending')).toHaveLength(1)
  })

  it('writes the submitted question with options, risk and attachments', async () => {
    seedRunningTicket(WORK_DIRECTORY)
    const tool = makeTool()
    const controller = new AbortController()

    const pending = tool.execute(
      {
        ...BASE_ARGS,
        risk: 'high',
        attachments: ['notes.md', join(WORK_DIRECTORY, 'report.html')],
      },
      execution(controller.signal),
    ) as Promise<Record<string, unknown>>
    await waitForPending()

    expect(pendingPayload()).toMatchObject({
      ticketId: TICKET_ID,
      question: '发布到生产会立刻影响用户。',
      options: BASE_ARGS.options,
      risk: 'high',
      requestedBySessionId: WORKER_SESSION,
    })
    expect(pendingPayload()).not.toHaveProperty('title')

    controller.abort()
    await expect(pending).rejects.toMatchObject({ code: 'approval-cancelled' })
  })

  it('resolves relative attachments against the ticket directory', async () => {
    seedRunningTicket(WORK_DIRECTORY)
    const tool = makeTool()
    const controller = new AbortController()

    const pending = tool.execute(
      { ...BASE_ARGS, attachments: [' notes.md ', 'notes.md', join(WORK_DIRECTORY, 'a.html')] },
      execution(controller.signal),
    ) as Promise<Record<string, unknown>>
    await waitForPending()

    expect(pendingPayload().attachments).toEqual([
      join(WORK_DIRECTORY, 'notes.md'),
      join(WORK_DIRECTORY, 'a.html'),
    ])

    controller.abort()
    await expect(pending).rejects.toMatchObject({ code: 'approval-cancelled' })
  })

  it('resolves relative attachments against the session directory without a ticket', async () => {
    const session = host.sessions.get(WORKER_SESSION)
    if (session === undefined) throw new Error('fake session missing')
    session.cwd = WORK_DIRECTORY
    const tool = makeTool()
    const controller = new AbortController()

    const pending = tool.execute(
      { ...BASE_ARGS, attachments: ['notes.md'] },
      execution(controller.signal),
    ) as Promise<Record<string, unknown>>
    await waitForPending()

    expect(pendingPayload().attachments).toEqual([join(WORK_DIRECTORY, 'notes.md')])

    controller.abort()
    await expect(pending).rejects.toMatchObject({ code: 'approval-cancelled' })
  })

  it('rejects a relative attachment when no working directory is available', async () => {
    seedRunningTicket()
    const tool = makeTool()

    await expect(
      tool.execute(
        { ...BASE_ARGS, attachments: ['notes.md'] },
        execution(new AbortController().signal),
      ),
    ).rejects.toMatchObject({ code: 'invalid-arguments' })
    expect(store.events().filter(event => event.type === 'approval/pending')).toEqual([])
  })

  it('rejects malformed attachments before writing anything', async () => {
    seedRunningTicket(WORK_DIRECTORY)
    const tool = makeTool()
    const signal = new AbortController().signal

    await expect(
      tool.execute({ ...BASE_ARGS, attachments: [42] }, execution(signal)),
    ).rejects.toMatchObject({ code: 'invalid-arguments' })
    await expect(
      tool.execute({ ...BASE_ARGS, attachments: ['   '] }, execution(signal)),
    ).rejects.toMatchObject({ code: 'invalid-arguments' })
    await expect(
      tool.execute({ ...BASE_ARGS, attachments: 'notes.md' }, execution(signal)),
    ).rejects.toMatchObject({ code: 'invalid-arguments' })
    await expect(
      tool.execute(
        {
          ...BASE_ARGS,
          attachments: Array.from({ length: 21 }, (_, index) => join(WORK_DIRECTORY, `${index}.md`)),
        },
        execution(signal),
      ),
    ).rejects.toMatchObject({ code: 'invalid-arguments' })
    expect(store.events().filter(event => event.type === 'approval/pending')).toEqual([])
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

  it('returns a custom answer as the decision body', async () => {
    seedRunningTicket()
    const tool = makeTool()
    const controller = new AbortController()

    const pending = tool.execute(BASE_ARGS, execution(controller.signal)) as Promise<Record<string, unknown>>
    const approvalId = await waitForPending()

    await resolvers.find(approvalId)?.deliver({
      decision: { kind: 'answered', answer: '先观察一晚' },
      decidedAt: 6,
    })

    await expect(pending).resolves.toEqual({
      approvalId,
      decision: { kind: 'answered', answer: '先观察一晚' },
      decidedAt: 6,
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

  it('submits a standalone approval when the calling session has no active ticket', async () => {
    const tool = makeTool()
    const controller = new AbortController()

    const pending = tool.execute(BASE_ARGS, execution(controller.signal, 'session-other')) as Promise<
      Record<string, unknown>
    >
    const approvalId = await waitForPending()

    expect(pendingPayload()).not.toHaveProperty('ticketId')
    await resolvers.find(approvalId)?.deliver({
      decision: { kind: 'selected', index: 0, label: '发布' },
      decidedAt: 7,
    })

    await expect(pending).resolves.toEqual({
      approvalId,
      decision: { kind: 'selected', index: 0, label: '发布' },
      decidedAt: 7,
    })
  })

  it('submits a standalone approval after the session ticket has ended', async () => {
    seedRunningTicket()
    store.append({
      type: 'task/closed',
      actor: 'system',
      correlationId: TICKET_ID,
      payload: { ticketId: TICKET_ID, outcome: 'completed' },
    })
    const tool = makeTool()
    const controller = new AbortController()

    const pending = tool.execute(BASE_ARGS, execution(controller.signal)) as Promise<Record<string, unknown>>
    await waitForPending()

    expect(pendingPayload()).not.toHaveProperty('ticketId')
    controller.abort()
    await expect(pending).rejects.toMatchObject({ code: 'approval-cancelled' })
  })

  it('does not bind a ticket id owned by another session', async () => {
    seedRunningTicket()
    const tool = makeTool()
    const controller = new AbortController()

    const pending = tool.execute(
      { ...BASE_ARGS, ticketId: TICKET_ID },
      execution(controller.signal, 'session-other'),
    ) as Promise<Record<string, unknown>>
    await waitForPending()

    expect(pendingPayload()).not.toHaveProperty('ticketId')
    controller.abort()
    await expect(pending).rejects.toMatchObject({ code: 'approval-cancelled' })
  })

  it('falls back to the session active ticket when the hint names another ticket', async () => {
    seedRunningTicket()
    const tool = makeTool()
    const controller = new AbortController()

    const pending = tool.execute(
      { ...BASE_ARGS, ticketId: 't-1111111111' },
      execution(controller.signal),
    ) as Promise<Record<string, unknown>>
    await waitForPending()

    expect(pendingPayload()).toMatchObject({ ticketId: TICKET_ID })
    controller.abort()
    await expect(pending).rejects.toMatchObject({ code: 'approval-cancelled' })
  })

  it('rejects when the execution has no calling session', async () => {
    const tool = makeTool()

    await expect(
      tool.execute(BASE_ARGS, { ...execution(new AbortController().signal), agent: undefined }),
    ).rejects.toMatchObject({ code: 'no-session' })
    expect(store.events()).toEqual([])
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
})

describe('presentationMeta', () => {
  type MetaWriter = (args: unknown, value: unknown) => unknown

  function writeMeta(value: unknown): Record<string, unknown> {
    const writer = (makeTool().output as { presentationMeta?: MetaWriter }).presentationMeta
    if (writer === undefined) throw new Error('presentationMeta is missing from the tool output')
    return writer({}, value) as Record<string, unknown>
  }

  it('persists exactly the fields the self-heal reader restores', () => {
    const meta = writeMeta({
      approvalId: 'a-1',
      decidedAt: 1_700_000_000_000,
      decision: { kind: 'selected', index: 1, label: '等等', answer: '先别发' },
    })

    expect(meta).toEqual({
      approvalId: 'a-1',
      decidedAt: 1_700_000_000_000,
      decision: { kind: 'selected', index: 1, label: '等等', answer: '先别发' },
    })
  })

  it('leaves absent decision fields out instead of persisting undefined', () => {
    const meta = writeMeta({ approvalId: 'a-2', decidedAt: 5, decision: { kind: 'skipped' } })

    expect(meta.decision).toEqual({ kind: 'skipped' })
    expect(Object.keys(meta.decision as object)).toEqual(['kind'])
  })
})
