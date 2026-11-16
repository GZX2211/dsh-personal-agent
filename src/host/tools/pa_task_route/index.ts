// src/host/tools/pa_task_route/index.ts
//
// router 的派发工具：只做「入队」这一件事，然后交给调度器决定何时放行。
// 因此它总是快速返回，返回里的状态是「此刻账本上的事实」，不是执行结果。

import { statSync } from 'node:fs'
import { isAbsolute } from 'node:path'
import { HarnessError } from '@deepseek-ai/dsh-llm'
import type { SessionId } from '@deepseek-ai/dsh-session'
import type { ToolDefinition, ToolRunContext } from '@deepseek-ai/dsh-tools'
import type { TaskMode } from '../../../shared/events.ts'
import type { HostContext } from '../../context.ts'
import { predictQueueReason } from '../../dispatcher/plan.ts'
import type { Scheduler } from '../../dispatcher/scheduler.ts'
import type { EventStore } from '../../store/event-store.ts'
import { shortTicketId } from '../../../shared/tickets.ts'
import { createTicketId } from '../../tickets/ids.ts'

const TASK_ROUTE_TOOL_NAME = 'pa_task_route'

export interface TaskRouteDependencies {
  ctx: HostContext
  store: EventStore
  scheduler: Scheduler
  /** 执行槽位上限，与调度器同源（方案 §5.3）。 */
  maxWorkers: number
}

export type TaskRouteErrorCode =
  | 'invalid-arguments'
  | 'invalid-append-target'
  | 'invalid-directory'
  | 'no-active-session'

export class TaskRouteError extends HarnessError {
  constructor(message: string, code: TaskRouteErrorCode) {
    super(message, code)
    this.name = 'TaskRouteError'
  }
}

export interface TaskRouteArgs {
  action: TaskMode
  title: string
  goal: string
  context?: string
  constraints?: string[]
  expectedOutput?: string
  workerSessionId?: string
  cwd?: string
}

/** 解析并收窄模型参数；稳定失败码让调用方按码分支。 */
export function parseTaskRouteArgs(raw: unknown): TaskRouteArgs {
  if (!isRecord(raw)) throw new TaskRouteError('参数必须是一个对象', 'invalid-arguments')
  const action = raw.action
  if (action !== 'dispatch' && action !== 'append') {
    throw new TaskRouteError('action 必须是 dispatch 或 append', 'invalid-arguments')
  }
  const title = requiredText(raw.title, 'title')
  if ([...title].length > 40) {
    throw new TaskRouteError(`title 最多 40 个字符（当前 ${[...title].length} 个）`, 'invalid-arguments')
  }
  const goal = requiredText(raw.goal, 'goal')

  const args: TaskRouteArgs = { action, title, goal }
  if (raw.context !== undefined) args.context = requiredText(raw.context, 'context')
  if (raw.expectedOutput !== undefined) args.expectedOutput = requiredText(raw.expectedOutput, 'expectedOutput')
  if (raw.constraints !== undefined) args.constraints = stringList(raw.constraints, 'constraints')
  if (raw.workerSessionId !== undefined) {
    args.workerSessionId = requiredText(raw.workerSessionId, 'workerSessionId')
  }
  if (raw.cwd !== undefined) args.cwd = requiredText(raw.cwd, 'cwd')
  if (action === 'append' && args.workerSessionId === undefined) {
    throw new TaskRouteError('action=append 时必须提供 workerSessionId', 'invalid-arguments')
  }
  return args
}

export function createTaskRouteTool(deps: TaskRouteDependencies): ToolDefinition {
  return {
    name: TASK_ROUTE_TOOL_NAME,
    description:
      '把一个需要动手完成的任务派发成工单。action=dispatch 新开执行会话；action=append 把新工单追加给已有的 worker 会话。只入队，不等待执行结果。',
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
        goal: { type: 'string', minLength: 1, description: '整理后的任务目标，不含闲聊。' },
        context: { type: 'string', description: '背景与用户原话摘录。' },
        constraints: {
          type: 'array',
          items: { type: 'string' },
          description: '约束与禁止事项。',
        },
        expectedOutput: { type: 'string', description: '验收标准。' },
        workerSessionId: { type: 'string', description: 'append 必填：目标 worker 会话 id。' },
        cwd: { type: 'string', description: '工单工作目录；缺省为状态目录下的 work/<工单 id>。' },
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
        },
      },
      render: (_args: unknown, value: unknown) => {
        const result = value as {
          ticketId: string
          status: string
          queueReason?: string
        }
        const short = shortTicketId(result.ticketId)
        if (result.status === 'running') return [{ type: 'text', text: `已放行工单 #${short}` }]
        const reason =
          result.queueReason === 'worker-busy'
            ? '等待该执行会话空闲'
            : result.queueReason === 'capacity-full'
              ? '执行名额已满'
              : '排队中'
        return [{ type: 'text', text: `已入队工单 #${short}（${reason}）` }]
      },
    },
    execute: async (rawArgs: unknown, exec: ToolRunContext) => {
      const args = parseTaskRouteArgs(rawArgs)
      const requestedBySessionId = exec.agent?.session.id
      if (requestedBySessionId === undefined) {
        throw new TaskRouteError('无法确定调用该工具的会话', 'no-active-session')
      }

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

      const inFlight = projection.tickets.filter(
        ticket => ticket.stage === 'running' || ticket.stage === 'blocked',
      ).length
      const queueReason = predictQueueReason({
        mode: args.action,
        workerBusy,
        freeSlots: deps.maxWorkers - inFlight,
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
          ...(args.context === undefined ? {} : { context: args.context }),
          ...(args.constraints === undefined ? {} : { constraints: args.constraints }),
          ...(args.expectedOutput === undefined ? {} : { expectedOutput: args.expectedOutput }),
          ...(args.cwd === undefined ? {} : { directory: args.cwd }),
          ...(queueReason === undefined ? {} : { queueReason }),
        },
      })

      await deps.scheduler.trigger('task-route')
      return readRouteResult(deps.store, ticketId)
    },
  }
}

/** 工单此刻在账本上的状态：放行了就带 sessionId，否则带排队原因。 */
function readRouteResult(
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
  deps: TaskRouteDependencies,
  projection: ReturnType<EventStore['projection']>,
  workerSessionId: string | undefined,
): void {
  const known = projection.tickets.some(ticket => ticket.workerSessionId === workerSessionId)
  if (!known) {
    throw new TaskRouteError(
      `workerSessionId ${workerSessionId ?? '(缺失)'} 不是本插件已知的执行会话`,
      'invalid-append-target',
    )
  }
  if (deps.ctx.workspaceRegistry.archivedSessionIds.includes(workerSessionId as SessionId)) {
    throw new TaskRouteError(`workerSessionId ${workerSessionId} 已被归档，不能追加`, 'invalid-append-target')
  }
}

function assertDirectory(path: string): void {
  if (!isAbsolute(path)) {
    throw new TaskRouteError(`cwd 必须是绝对路径：${path}`, 'invalid-directory')
  }
  try {
    if (!statSync(path).isDirectory()) {
      throw new TaskRouteError(`cwd 不是目录：${path}`, 'invalid-directory')
    }
  } catch (error) {
    if (error instanceof TaskRouteError) throw error
    throw new TaskRouteError(`cwd 不存在或不可访问：${path}`, 'invalid-directory')
  }
}

function requiredText(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TaskRouteError(`${field} 必须是非空字符串`, 'invalid-arguments')
  }
  return value.trim()
}

function stringList(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || !value.every(item => typeof item === 'string')) {
    throw new TaskRouteError(`${field} 必须是字符串数组`, 'invalid-arguments')
  }
  return value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
