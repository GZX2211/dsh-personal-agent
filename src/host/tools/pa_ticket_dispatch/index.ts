// src/host/tools/pa_ticket_dispatch/index.ts
//
// router 的派单工具：只做「入队」这一件事，然后交给调度器决定何时放行。
// 返回里的状态是「调用结束时账本上的事实」；容量空闲时调度会在本次调用内完成
// 放行与工单说明投递，所以返回值可能已经是 running，而不是一定停在 queued。

import { statSync } from 'node:fs'
import { isAbsolute } from 'node:path'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { HarnessError } from '@deepseek-ai/dsh-llm'
import type { SessionId } from '@deepseek-ai/dsh-session'
import type { ToolDefinition, ToolRunContext } from '@deepseek-ai/dsh-tools'
import type { TaskMode } from '../../../shared/events.ts'
import type { HostContext } from '../../context.ts'
import { predictQueueReason } from '../../dispatcher/plan.ts'
import type { Scheduler } from '../../dispatcher/scheduler.ts'
import type { ClaimRegistry } from '../../signals/claim.ts'
import type { EventStore } from '../../store/event-store.ts'
import { shortTicketId } from '../../../shared/tickets.ts'
import { createTicketId } from '../../ids.ts'
import { claimTurnSignal } from '../turn-signal.ts'

const TICKET_DISPATCH_TOOL_NAME = 'pa_ticket_dispatch'

export interface TicketDispatchDependencies {
  ctx: HostContext
  store: EventStore
  scheduler: Scheduler
  /** 信号认领簿：派单动作据此与它处理的那条输入绑定。 */
  claims: ClaimRegistry
  /** 执行槽位上限，与调度器同源（方案 §5.3）；用 getter 让设置改动立即生效。 */
  maxWorkers: () => number
}

export type TicketDispatchErrorCode =
  | 'invalid-arguments'
  | 'invalid-append-target'
  | 'invalid-directory'
  | 'invalid-signal'
  | 'no-active-session'

export class TicketDispatchError extends HarnessError {
  constructor(message: string, code: TicketDispatchErrorCode) {
    super(message, code)
    this.name = 'TicketDispatchError'
  }
}

export interface TicketDispatchArgs {
  action: TaskMode
  title: string
  goal: string
  workerSessionId?: string
  cwd?: string
  signalId?: string
}

/** 解析并收窄模型参数；稳定失败码让调用方按码分支。 */
export function parseTicketDispatchArgs(raw: unknown): TicketDispatchArgs {
  if (!isRecord(raw)) throw new TicketDispatchError('参数必须是一个对象', 'invalid-arguments')
  const action = raw.action
  if (action !== 'dispatch' && action !== 'append') {
    throw new TicketDispatchError('action 必须是 dispatch 或 append', 'invalid-arguments')
  }
  const title = requiredText(raw.title, 'title')
  if ([...title].length > 40) {
    throw new TicketDispatchError(`title 最多 40 个字符（当前 ${[...title].length} 个）`, 'invalid-arguments')
  }
  const goal = requiredText(raw.goal, 'goal')

  const args: TicketDispatchArgs = { action, title, goal }
  if (raw.workerSessionId !== undefined) {
    args.workerSessionId = requiredText(raw.workerSessionId, 'workerSessionId')
  }
  if (raw.cwd !== undefined) args.cwd = requiredText(raw.cwd, 'cwd')
  if (raw.signalId !== undefined) args.signalId = requiredText(raw.signalId, 'signalId')
  if (action === 'append' && args.workerSessionId === undefined) {
    throw new TicketDispatchError('action=append 时必须提供 workerSessionId', 'invalid-arguments')
  }
  return args
}

export function createTicketDispatchTool(deps: TicketDispatchDependencies): ToolDefinition {
  return {
    name: TICKET_DISPATCH_TOOL_NAME,
    description:
      '把一张需要动手完成的工单交给执行会话：action=dispatch 新开执行会话；action=append 把新工单追加给已有的 worker 会话。只入队，不等待执行结果。调用时会自动关联本回合最早的一条输入事件；同一回合有多条输入时用 signalId 指定要处理的那一条。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['action', 'title', 'goal'],
      properties: {
        action: {
          type: 'string',
          enum: ['dispatch', 'append'],
          description: 'dispatch：新开执行会话；append：追加到 workerSessionId 指定的会话。',
        },
        title: { type: 'string', minLength: 1, maxLength: 40, description: '工单标题，最多 40 字。' },
        goal: {
          type: 'string',
          minLength: 1,
          description:
            '这件事要达成什么：用一句目标说清结果；只转述事件里的事实，不要替执行者定义验收标准或执行约束。',
        },
        workerSessionId: { type: 'string', description: 'append 必填：目标 worker 会话 id。' },
        cwd: { type: 'string', description: '工单工作目录；缺省为状态目录下的 work/<工单 id>。' },
        signalId: {
          type: 'string',
          description:
            '这个动作处理的是哪条输入事件。一个回合里有多条待处理事件时用它明确指认；不传则按到达顺序自动关联。',
        },
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['ticketId', 'status'],
        properties: {
          ticketId: { type: 'string' },
          status: { type: 'string', enum: ['queued', 'running'] },
          sessionId: { type: 'string' },
          queueReason: { type: 'string', enum: ['worker-busy', 'capacity-full'] },
          signalId: { type: 'string' },
        },
      },
      render: (_args: unknown, value: unknown) => {
        const result = value as {
          ticketId: string
          status: string
          queueReason?: string
          signalId?: string
        }
        const short = shortTicketId(result.ticketId)
        const bound = result.signalId === undefined ? '' : `，关联事件 ${result.signalId}`
        if (result.status === 'running') return [{ type: 'text', text: `已放行工单 #${short}${bound}` }]
        const reason =
          result.queueReason === 'worker-busy'
            ? '等待该执行会话空闲'
            : result.queueReason === 'capacity-full'
              ? '执行名额已满'
              : '排队中'
        return [{ type: 'text', text: `已入队工单 #${short}（${reason}）${bound}` }]
      },
    },
    execute: async (rawArgs: unknown, exec: ToolRunContext) => {
      const args = parseTicketDispatchArgs(rawArgs)
      const agent = exec.agent
      if (agent === undefined) {
        throw new TicketDispatchError('无法确定调用该工具的会话', 'no-active-session')
      }
      const requestedBySessionId = agent.session.id

      const projection = deps.store.projection()
      const workerBusy =
        args.action === 'append' &&
        projection.tickets.some(
          ticket =>
            ticket.workerSessionId === args.workerSessionId &&
            (ticket.stage === 'running' || ticket.stage === 'blocked'),
        )
      if (args.action === 'append') assertAppendTarget(deps, projection, args.workerSessionId)
      if (args.cwd !== undefined) assertDirectory(args.cwd)

      // 认领必须发生在任何账本写入之前：指认无效时不能留下一条没有来源的工单。
      const claimed = claimSignal(deps, agent, args.signalId)

      const inFlight = projection.tickets.filter(
        ticket => ticket.stage === 'running' || ticket.stage === 'blocked',
      ).length
      const queueReason = predictQueueReason({
        mode: args.action,
        workerBusy,
        freeSlots: deps.maxWorkers() - inFlight,
      })

      const ticketId = createTicketId()
      deps.store.append({
        type: 'task/queued',
        actor: 'router',
        correlationId: ticketId,
        sessionId: requestedBySessionId,
        payload: {
          ticketId,
          title: args.title,
          goal: args.goal,
          mode: args.action,
          requestedBySessionId,
          ...(args.workerSessionId === undefined ? {} : { workerSessionId: args.workerSessionId }),
          ...(args.cwd === undefined ? {} : { directory: args.cwd }),
          ...(queueReason === undefined ? {} : { queueReason }),
        },
      })

      if (claimed !== undefined) {
        deps.store.append({
          type: 'decision/recorded',
          actor: 'router',
          correlationId: claimed,
          sessionId: requestedBySessionId,
          payload: { action: args.action, signalId: claimed, ticketId },
        })
      }

      await deps.scheduler.trigger('ticket-dispatch')
      const result = readDispatchResult(deps.store, ticketId)
      return claimed === undefined ? result : { ...result, signalId: claimed }
    },
  }
}

/**
 * 认领本回合的一条待处理信号；指认无效时按本工具的错误码失败。
 */
function claimSignal(
  deps: TicketDispatchDependencies,
  agent: Agent,
  explicitSignalId: string | undefined,
): string | undefined {
  const outcome = claimTurnSignal(deps.ctx, deps.claims, agent, explicitSignalId)
  if (!outcome.ok) {
    throw new TicketDispatchError(
      `signalId ${explicitSignalId ?? '(缺失)'} 不是本回合待处理的信号`,
      'invalid-signal',
    )
  }
  return outcome.signalId
}

/** 工单此刻在账本上的状态：放行了就带 sessionId，否则带排队原因。 */
function readDispatchResult(
  store: EventStore,
  ticketId: string,
): { ticketId: string; status: 'queued' | 'running'; sessionId?: string; queueReason?: string } {
  const ticket = store.projection().tickets.find(item => item.id === ticketId)
  if (ticket?.workerSessionId !== undefined) {
    return { ticketId, status: 'running', sessionId: ticket.workerSessionId }
  }
  return {
    ticketId,
    status: 'queued',
    ...(ticket?.queueReason === undefined ? {} : { queueReason: ticket.queueReason }),
  }
}

function assertAppendTarget(
  deps: TicketDispatchDependencies,
  projection: ReturnType<EventStore['projection']>,
  workerSessionId: string | undefined,
): void {
  const known = projection.tickets.some(ticket => ticket.workerSessionId === workerSessionId)
  if (!known) {
    throw new TicketDispatchError(
      `workerSessionId ${workerSessionId ?? '(缺失)'} 不是本插件已知的执行会话`,
      'invalid-append-target',
    )
  }
  if (deps.ctx.workspaceRegistry.archivedSessionIds.includes(workerSessionId as SessionId)) {
    throw new TicketDispatchError(`workerSessionId ${workerSessionId} 已被归档，不能追加`, 'invalid-append-target')
  }
}

function assertDirectory(path: string): void {
  if (!isAbsolute(path)) {
    throw new TicketDispatchError(`cwd 必须是绝对路径：${path}`, 'invalid-directory')
  }
  try {
    if (!statSync(path).isDirectory()) {
      throw new TicketDispatchError(`cwd 不是目录：${path}`, 'invalid-directory')
    }
  } catch (error) {
    if (error instanceof TicketDispatchError) throw error
    throw new TicketDispatchError(`cwd 不存在或不可访问：${path}`, 'invalid-directory')
  }
}

function requiredText(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TicketDispatchError(`${field} 必须是非空字符串`, 'invalid-arguments')
  }
  return value.trim()
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
