// src/host/tools/pa_ticket_supplement/index.ts
//
// router 的补充工具：给一张正在执行的工单插一条信息，不建工单。
//
// 顺序是「先送达、后记账」：投递失败时不留下任何账本事实，失败也不会看起来像成功。
// 送达方式固定为 steer——补充属于当前回合，followup 会起一个不属于任何工单的新回合。

import { createHash } from 'node:crypto'
import { HarnessError } from '@deepseek-ai/dsh-llm'
import type { SessionId } from '@deepseek-ai/dsh-session'
import type { ToolDefinition, ToolRunContext } from '@deepseek-ai/dsh-tools'
import { shortTicketId, type TicketView } from '../../../shared/tickets.ts'
import type { HostContext } from '../../context.ts'
import { DeliveryError, deliverToSession, type DeliveryOutcome } from '../../sessions/delivery.ts'
import { deliveryMessageId } from '../../sessions/message.ts'
import type { ClaimRegistry } from '../../signals/claim.ts'
import type { EventStore } from '../../store/event-store.ts'
import { claimTurnSignal } from '../turn-signal.ts'

const TICKET_SUPPLEMENT_TOOL_NAME = 'pa_ticket_supplement'

/** 一次补充的正文上限：够说清一段事实，又不至于把链路详情撑爆。 */
export const SUPPLEMENT_TEXT_LIMIT = 4000

export interface TicketSupplementDependencies {
  ctx: HostContext
  store: EventStore
  claims: ClaimRegistry
}

export type TicketSupplementErrorCode =
  | 'invalid-arguments'
  | 'no-active-session'
  | 'ticket-not-found'
  | 'ticket-not-running'
  | 'session-not-live'
  | 'invalid-signal'
  | 'delivery-failed'

export class TicketSupplementError extends HarnessError {
  constructor(message: string, code: TicketSupplementErrorCode) {
    super(message, code)
    this.name = 'TicketSupplementError'
  }
}

export interface TicketSupplementArgs {
  ticketId: string
  text: string
  signalId?: string
}

/** 解析并收窄模型参数；稳定失败码让调用方按码分支。 */
export function parseTicketSupplementArgs(raw: unknown): TicketSupplementArgs {
  if (!isRecord(raw)) throw new TicketSupplementError('参数必须是一个对象', 'invalid-arguments')
  const ticketId = requiredText(raw.ticketId, 'ticketId')
  const text = requiredText(raw.text, 'text')
  if ([...text].length > SUPPLEMENT_TEXT_LIMIT) {
    throw new TicketSupplementError(
      `text 最多 ${SUPPLEMENT_TEXT_LIMIT} 个字符（当前 ${[...text].length} 个），请压缩成一段结论`,
      'invalid-arguments',
    )
  }
  const args: TicketSupplementArgs = { ticketId, text }
  if (raw.signalId !== undefined) args.signalId = requiredText(raw.signalId, 'signalId')
  return args
}

/**
 * 补充的投递幂等键：同一张单 + 同一段文本视为同一条补充。
 *
 * 用文本哈希而不是随机 id：模型重复下一次同样的工具调用时，消息不该再投一次。
 */
export function supplementRequestId(ticketId: string, text: string): string {
  const digest = createHash('sha256').update(text, 'utf8').digest('hex')
  return `pa-supplement:${ticketId}:${digest.slice(0, 16)}`
}

export function createTicketSupplementTool(deps: TicketSupplementDependencies): ToolDefinition {
  return {
    name: TICKET_SUPPLEMENT_TOOL_NAME,
    description:
      '把一条新到的事实转发给正在执行的工单：直接插进它当前回合的下一步，不新建工单、不起新回合。'
      + '只转述事件里的事实，不要写执行建议、验收标准或约束判断；需要派新工单时用 pa_ticket_dispatch。'
      + '工单还在排队或已经结束时不能转发——那时应该派发一张新工单。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['ticketId', 'text'],
      properties: {
        ticketId: {
          type: 'string',
          minLength: 1,
          description: '要补充的工单 id：t- 开头的完整 id，不是列表里的短码。',
        },
        text: {
          type: 'string',
          minLength: 1,
          maxLength: SUPPLEMENT_TEXT_LIMIT,
          description:
            '要转给执行中工单的新事实（用户原话、感知事件或定时提醒的内容）；忠实转述即可，不要写执行建议、验收标准或约束判断。',
        },
        signalId: {
          type: 'string',
          description:
            '这条补充处理的是哪条输入事件。一个回合里有多条待处理事件时用它明确指认；不传则按到达顺序自动关联。',
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
          status: { type: 'string', enum: ['delivered', 'already-queued'] },
          signalId: { type: 'string' },
        },
      },
      render: (_args: unknown, value: unknown) => {
        const result = value as { ticketId: string; status: string; signalId?: string }
        const short = shortTicketId(result.ticketId)
        const bound = result.signalId === undefined ? '' : `，关联事件 ${result.signalId}`
        if (result.status === 'already-queued') {
          return [{ type: 'text', text: `工单 #${short} 已收到同一条补充，没有重复投递${bound}` }]
        }
        return [{ type: 'text', text: `已向工单 #${short} 补充，会在下一步生效${bound}` }]
      },
    },
    execute: async (rawArgs: unknown, exec: ToolRunContext) => {
      const args = parseTicketSupplementArgs(rawArgs)
      const agent = exec.agent
      if (agent === undefined) {
        throw new TicketSupplementError('无法确定调用该工具的会话', 'no-active-session')
      }
      const requestedBySessionId = agent.session.id
      const ticket = findTicket(deps.store, args.ticketId)
      assertSupplementable(ticket)
      const targetSessionId = ticket.workerSessionId
      if (targetSessionId === undefined) {
        throw new TicketSupplementError(
          `工单 #${shortTicketId(ticket.id)} 还没有执行会话，不能补充`,
          'ticket-not-running',
        )
      }

      // 认领发生在任何副作用之前：指认无效时不该已经送出一条消息。
      const claimed = claimTurnSignal(deps.ctx, deps.claims, agent, args.signalId)
      if (!claimed.ok) {
        throw new TicketSupplementError(
          `signalId ${args.signalId ?? '(缺失)'} 不是本回合待处理的信号`,
          'invalid-signal',
        )
      }

      const requestId = supplementRequestId(ticket.id, args.text)
      const outcome = await deliver(deps, ticket, targetSessionId, requestId, args.text)

      deps.store.append({
        type: 'task/supplemented',
        actor: 'router',
        correlationId: ticket.id,
        sessionId: requestedBySessionId,
        payload: {
          ticketId: ticket.id,
          targetSessionId,
          text: args.text,
          requestedBySessionId,
          messageId: deliveryMessageId(requestId),
        },
      })
      if (claimed.signalId !== undefined) {
        deps.store.append({
          type: 'decision/recorded',
          actor: 'router',
          correlationId: claimed.signalId,
          sessionId: requestedBySessionId,
          payload: { action: 'supplement', signalId: claimed.signalId, ticketId: ticket.id },
        })
      }

      return {
        ticketId: ticket.id,
        status: outcome,
        ...(claimed.signalId === undefined ? {} : { signalId: claimed.signalId }),
      }
    },
  }
}

/** 投递并按失败原因给出可行动的码：会话不在线可以换路，其它投递失败可以重试。 */
async function deliver(
  deps: TicketSupplementDependencies,
  ticket: TicketView,
  targetSessionId: string,
  requestId: string,
  text: string,
): Promise<DeliveryOutcome> {
  const short = shortTicketId(ticket.id)
  try {
    return await deliverToSession(deps.ctx, targetSessionId as SessionId, {
      requestId,
      text,
      target: 'steer',
      ticketId: ticket.id,
      supplementId: requestId,
    })
  } catch (error) {
    if (error instanceof DeliveryError) {
      throw new TicketSupplementError(
        `工单 #${short} 的执行会话 ${targetSessionId} 已不在线（可能被归档或已销毁）；`
          + '请用 pa_ticket_dispatch 追加一张新工单',
        'session-not-live',
      )
    }
    throw new TicketSupplementError(
      `补充没有送达工单 #${short} 的执行会话：${describe(error)}；未写入任何账本事实，可以重试`,
      'delivery-failed',
    )
  }
}

function findTicket(store: EventStore, ticketId: string): TicketView {
  const ticket = store.projection().tickets.find(item => item.id === ticketId)
  if (ticket === undefined) {
    throw new TicketSupplementError(
      `工单 ${ticketId} 不存在；ticketId 必须是 t- 开头的完整 id（短码不能用来补充）`,
      'ticket-not-found',
    )
  }
  return ticket
}

/**
 * 只有正在执行的工单能补充。
 *
 * 排队中还没有执行者，已结束的叙述已经收口：两种情况下「插话」都无处可插，
 * 报错要指向真正可行的动作，而不是让 router 反复重试。
 */
function assertSupplementable(ticket: TicketView): void {
  if (ticket.stage === 'running' || ticket.stage === 'blocked') return
  const short = shortTicketId(ticket.id)
  if (ticket.stage === 'queued') {
    throw new TicketSupplementError(
      `工单 #${short} 还在排队，没有执行会话可插话；等它放行后再补充，或派发一张新工单`,
      'ticket-not-running',
    )
  }
  const outcome = ticket.outcome === undefined ? '' : `（结果 ${ticket.outcome}）`
  throw new TicketSupplementError(
    `工单 #${short} 已结束${outcome}，不能再补充；要继续这件事请用 pa_ticket_dispatch append 追加到执行会话`,
    'ticket-not-running',
  )
}

function requiredText(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TicketSupplementError(`${field} 必须是非空字符串`, 'invalid-arguments')
  }
  return value.trim()
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
