// src/host/tools/pa_approval_submit/index.ts
//
// worker 的审批工具：写入 approval/pending 后**阻塞**等待人的决定。
// 决定先送达本工具，工具确认已收到（acknowledge）之后，服务端才写
// approval/decided —— 这是「先送达、后记账」的实现位置（方案 §6.2）。
//
// 审批不依赖工单：有进行中工单时自动关联（工单页据此显示阻塞阶段），
// 工单已结束或会话没有工单时仍可提交，只是不绑定任何工单。
//
// 人的回答：选一个选项、填一段文本（自定义答案）或跳过。选项与文本本质都是答案，
// 都会随决定送达 worker。附件是 worker 在这时带上的文件（人只读），因此在这里归一成绝对路径，卡片才能直接打开。

import { isAbsolute, join } from 'node:path'
import { HarnessError } from '@deepseek-ai/dsh-llm'
import type { Session, SessionId } from '@deepseek-ai/dsh-session'
import type { ToolDefinition, ToolRunContext } from '@deepseek-ai/dsh-tools'
import {
  APPROVAL_RISKS,
  type ApprovalOption,
  type ApprovalRisk,
} from '../../../shared/approvals.ts'
import { approvalCorrelationId, createApprovalId, shortApprovalId } from '../../approvals/ids.ts'
import {
  ApprovalCancelledError,
  type ApprovalDelivery,
  type PendingResolver,
  type ResolverRegistry,
} from '../../approvals/resolvers.ts'
import type { HostContext } from '../../context.ts'
import type { EventStore } from '../../store/event-store.ts'

const APPROVAL_SUBMIT_TOOL_NAME = 'pa_approval_submit'

/** 一次审批能带的文件上限：够说明产物，又不会让卡片变成文件列表。 */
export const MAX_ATTACHMENTS = 20

export interface ApprovalSubmitDependencies {
  ctx: HostContext
  store: EventStore
  resolvers: ResolverRegistry
}

export type ApprovalSubmitErrorCode =
  | 'invalid-arguments'
  | 'invalid-options'
  | 'no-session'
  | 'approval-cancelled'

export class ApprovalSubmitError extends HarnessError {
  constructor(message: string, code: ApprovalSubmitErrorCode) {
    super(message, code)
    this.name = 'ApprovalSubmitError'
  }
}

export interface ApprovalSubmitArgs {
  question: string
  options: ApprovalOption[]
  /** 相对路径按工单工作目录解析，没有工单时按会话工作目录；绝对路径原样保留。 */
  attachments?: string[]
  risk?: ApprovalRisk
  /** 可选的工单关联提示：只有属于本会话且进行中的工单才会被采用。 */
  ticketId?: string
}

export function parseApprovalSubmitArgs(raw: unknown): ApprovalSubmitArgs {
  if (!isRecord(raw)) throw new ApprovalSubmitError('参数必须是一个对象', 'invalid-arguments')
  const question = requiredText(raw.question, 'question')
  const options = parseOptions(raw.options)
  const args: ApprovalSubmitArgs = { question, options }
  if (raw.attachments !== undefined) args.attachments = parseAttachments(raw.attachments)
  if (raw.risk !== undefined) {
    if (!APPROVAL_RISKS.includes(raw.risk as ApprovalRisk)) {
      throw new ApprovalSubmitError(`risk 必须是 ${APPROVAL_RISKS.join('、')} 之一`, 'invalid-arguments')
    }
    args.risk = raw.risk as ApprovalRisk
  }
  if (raw.ticketId !== undefined) args.ticketId = requiredText(raw.ticketId, 'ticketId')
  return args
}

export function createApprovalSubmitTool(deps: ApprovalSubmitDependencies): ToolDefinition {
  return {
    name: APPROVAL_SUBMIT_TOOL_NAME,
    description:
      '需要人类决定时使用：提交一个审批并等待决定。调用会一直阻塞到有人处理，返回决定内容后按决定继续。'
      + '审批不依赖工单：有进行中的工单时会自动关联，没有工单也能提交。'
      + '如果有让人看/改的文件，用 attachments 一起交上去。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['question', 'options'],
      properties: {
        question: { type: 'string', minLength: 1, description: '要人决定的事：背景、每个选项的含义与后果。' },
        options: {
          type: 'array',
          minItems: 2,
          maxItems: 4,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['label', 'description'],
            properties: {
              label: { type: 'string', minLength: 1, description: '选项标签，两字以内最佳。' },
              description: { type: 'string', minLength: 1, description: '这个选项的后果。' },
            },
          },
          description: '2 到 4 个选项。',
        },
        attachments: {
          type: 'array',
          maxItems: MAX_ATTACHMENTS,
          items: { type: 'string', minLength: 1 },
          description:
            '随审批附上的文件路径：相对路径按工单工作目录解析，没有工单时按会话工作目录；人可在右侧栏打开查看。',
        },
        risk: { type: 'string', enum: ['low', 'medium', 'high'], description: '风险等级，供审批页排序与强调。' },
        ticketId: {
          type: 'string',
          description: '可选：指定要关联的进行中工单；不属于本会话或已结束时忽略，审批照常提交。',
        },
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['approvalId', 'decision', 'decidedAt'],
        properties: {
          approvalId: { type: 'string' },
          decision: {
            type: 'object',
            required: ['kind'],
            properties: {
              kind: { type: 'string', enum: ['selected', 'answered', 'skipped'] },
              index: { type: 'number' },
              label: { type: 'string' },
              answer: { type: 'string' },
            },
          },
          decidedAt: { type: 'number' },
        },
      },
      render: (_args: unknown, value: unknown) => {
        const result = value as { approvalId: string; decision: { kind: string; label?: string; answer?: string } }
        const short = shortApprovalId(result.approvalId)
        const outcome =
          result.decision.kind === 'skipped'
            ? '已跳过（由你自行决定或放弃该动作）'
            : result.decision.kind === 'answered'
              ? `答案：${result.decision.answer ?? ''}`
              : `已选择：${result.decision.label ?? ''}`
        return [{ type: 'text', text: `审批 #${short} ${outcome}` }]
      },
      // 决定内容随 tool/result 持久化：启动自愈据此恢复「已送达但未记账」的审批。
      presentationMeta: (_args: unknown, value: unknown) => {
        const result = value as {
          approvalId: string
          decidedAt: number
          decision: {
            kind: 'selected' | 'answered' | 'skipped'
            index?: number
            label?: string
            answer?: string
          }
        }
        const decision = result.decision
        return {
          approvalId: result.approvalId,
          decidedAt: result.decidedAt,
          decision: {
            kind: decision.kind,
            ...(decision.index === undefined ? {} : { index: decision.index }),
            ...(decision.label === undefined ? {} : { label: decision.label }),
            ...(decision.answer === undefined ? {} : { answer: decision.answer }),
          },
        }
      },
    },
    execute: async (rawArgs: unknown, exec: ToolRunContext) => {
      const args = parseApprovalSubmitArgs(rawArgs)
      const session = exec.agent?.session
      if (session === undefined) {
        throw new ApprovalSubmitError('无法确定调用该工具的会话', 'no-session')
      }
      const sessionId = session.id
      const ticket = findSessionTicket(deps, args.ticketId, sessionId)
      const attachments = resolveAttachments(
        args.attachments,
        ticket?.directory ?? sessionDirectory(deps, session),
      )

      const approvalId = createApprovalId()
      const resolver = deps.resolvers.create(approvalId)
      deps.store.append({
        type: 'approval/pending',
        actor: 'worker',
        correlationId: approvalCorrelationId(approvalId, ticket?.id),
        sessionId,
        payload: {
          approvalId,
          ...(ticket === undefined ? {} : { ticketId: ticket.id }),
          question: args.question,
          options: args.options,
          requestedBySessionId: sessionId,
          ...(attachments.length === 0 ? {} : { attachments }),
          ...(args.risk === undefined ? {} : { risk: args.risk }),
        },
      })

      let delivery: ApprovalDelivery
      try {
        delivery = await waitForDelivery(resolver, exec.signal)
      } catch (error) {
        if (error instanceof ApprovalCancelledError) {
          throw new ApprovalSubmitError(
            '回合已中止，审批仍待处理；决定会以 followup 送达',
            'approval-cancelled',
          )
        }
        throw error
      }

      // 先确认收到，服务端才开始写 approval/decided。
      resolver.acknowledge()
      return toResult(approvalId, delivery)
    },
  }
}

function toResult(approvalId: string, delivery: ApprovalDelivery): Record<string, unknown> {
  const { kind, index, label, answer } = delivery.decision
  const decision =
    kind === 'selected'
      ? { kind, index, label }
      : kind === 'answered'
        ? { kind, answer }
        : { kind: 'skipped' }
  return {
    approvalId,
    // 文本答案与选项都会送达 worker，所以 answer 不随 kind 分支丢弃。
    decision: { ...decision, ...(answer === undefined ? {} : { answer }) },
    decidedAt: delivery.decidedAt,
  }
}

/**
 * 当前会话可关联的进行中工单。
 *
 * 显式 ticketId 只是提示：只有它属于本会话且仍在进行中时才采用；否则退回本会话
 * 的其它进行中工单，完全没有就返回 undefined（独立审批）。审批能否提交不取决于
 * 这里的结果——没有工单只是少一层关联，不是失败。
 */
function findSessionTicket(
  deps: ApprovalSubmitDependencies,
  ticketId: string | undefined,
  sessionId: SessionId,
): { id: string; directory?: string } | undefined {
  const active = deps.store
    .projection()
    .tickets.filter(ticket => ticket.workerSessionId === sessionId && ticket.stage !== 'ended')
  if (ticketId !== undefined) {
    const hinted = active.find(ticket => ticket.id === ticketId)
    if (hinted !== undefined) return hinted
  }
  return active[0]
}

/**
 * 会话的当前工作目录，用于没有工单时解释相对附件。
 *
 * 目录服务不可用时降级为 undefined：相对附件会得到一条可行动的参数错误，
 * 而不是让整个审批提交失败。绝对路径不依赖这个结果。
 */
function sessionDirectory(deps: ApprovalSubmitDependencies, session: Session): string | undefined {
  try {
    return deps.ctx.workingDirectory.get(session)
  } catch {
    return undefined
  }
}

/**
 * 把 worker 给的附件归一成绝对路径。
 *
 * 相对路径需要工单或会话的工作目录，而只有 Host 知道那个目录；解析不了就当场
 * 失败，而不是留给卡片去猜一个打不开的地址。
 */
export function resolveAttachments(
  attachments: readonly string[] | undefined,
  directory: string | undefined,
): string[] {
  if (attachments === undefined) return []
  const resolved: string[] = []
  const seen = new Set<string>()
  for (const attachment of attachments) {
    const path = attachment.trim()
    const absolute = isAbsolute(path) ? path : directory === undefined ? undefined : join(directory, path)
    if (absolute === undefined) {
      throw new ApprovalSubmitError(
        `附件 ${path} 是相对路径，但没有可用的工作目录；请给出绝对路径`,
        'invalid-arguments',
      )
    }
    // 归一之后再查重：同一文件的绝对与相对写法只保留一次。
    if (seen.has(absolute)) continue
    seen.add(absolute)
    resolved.push(absolute)
  }
  return resolved
}

function waitForDelivery(resolver: PendingResolver, signal: AbortSignal): Promise<ApprovalDelivery> {
  if (signal.aborted) {
    resolver.cancel()
    return Promise.reject(new ApprovalCancelledError())
  }
  return new Promise((resolve, reject) => {
    const onAbort = (): void => {
      resolver.cancel()
      reject(new ApprovalCancelledError())
    }
    signal.addEventListener('abort', onAbort, { once: true })
    resolver.decision.then(
      delivery => {
        signal.removeEventListener('abort', onAbort)
        resolve(delivery)
      },
      error => {
        signal.removeEventListener('abort', onAbort)
        reject(error)
      },
    )
  })
}

function parseOptions(value: unknown): ApprovalOption[] {
  if (!Array.isArray(value) || value.length < 2 || value.length > 4) {
    throw new ApprovalSubmitError('options 必须是 2 到 4 个选项', 'invalid-options')
  }
  return value.map((option, index) => {
    if (!isRecord(option)) {
      throw new ApprovalSubmitError(`options[${index}] 必须是对象`, 'invalid-options')
    }
    const label = requiredText(option.label, `options[${index}].label`)
    const description = requiredText(option.description, `options[${index}].description`)
    return { label, description }
  })
}

function parseAttachments(value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw new ApprovalSubmitError('attachments 必须是字符串数组', 'invalid-arguments')
  }
  if (value.length > MAX_ATTACHMENTS) {
    throw new ApprovalSubmitError(`attachments 最多 ${MAX_ATTACHMENTS} 个`, 'invalid-arguments')
  }
  return value.map((item, index) => requiredText(item, `attachments[${index}]`))
}

function requiredText(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ApprovalSubmitError(`${field} 必须是非空字符串`, 'invalid-arguments')
  }
  return value.trim()
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
