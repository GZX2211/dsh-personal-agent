// src/host/tools/pa_approval_submit/index.ts
//
// worker 的审批工具：写入 approval/pending 后**阻塞**等待人的决定。
// 决定先送达本工具，工具确认已收到（acknowledge）之后，服务端才写
// approval/decided —— 这是「先送达、后记账」的实现位置（方案 §6.2）。
//
// 人的回答只有两种：选一个选项或跳过，外加自由文本 `note`。附件是 worker
// 在这时带上的文件（人只读），因此在这里归一成绝对路径，卡片才能直接打开。

import { isAbsolute, join } from 'node:path'
import { HarnessError } from '@deepseek-ai/dsh-llm'
import type { SessionId } from '@deepseek-ai/dsh-session'
import type { ToolDefinition, ToolRunContext } from '@deepseek-ai/dsh-tools'
import {
  APPROVAL_RISKS,
  type ApprovalOption,
  type ApprovalRisk,
} from '../../../shared/approvals.ts'
import { createApprovalId, shortApprovalId } from '../../approvals/ids.ts'
import {
  ApprovalCancelledError,
  type ApprovalDelivery,
  type PendingResolver,
  type ResolverRegistry,
} from '../../approvals/resolvers.ts'
import type { HostContext } from '../../context.ts'
import type { EventStore } from '../../store/event-store.ts'

export const APPROVAL_SUBMIT_TOOL_NAME = 'pa_approval_submit'

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
  | 'no-active-ticket'
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
  /** 相对路径按工单工作目录解析；绝对路径原样保留。 */
  attachments?: string[]
  risk?: ApprovalRisk
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
          description: '随审批附上的文件路径：相对路径按工单工作目录解析，人可在右侧栏打开查看。',
        },
        risk: { type: 'string', enum: ['low', 'medium', 'high'], description: '风险等级，供审批页排序与强调。' },
        ticketId: { type: 'string', description: '缺省取当前会话绑定的进行中工单。' },
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
              kind: { type: 'string', enum: ['selected', 'skipped'] },
              index: { type: 'number' },
              label: { type: 'string' },
            },
          },
          note: { type: 'string' },
          decidedAt: { type: 'number' },
        },
      },
      render: (_args: unknown, value: unknown) => {
        const result = value as { approvalId: string; decision: { kind: string; label?: string } }
        const short = shortApprovalId(result.approvalId)
        const outcome =
          result.decision.kind === 'skipped'
            ? '已跳过（由你自行决定或放弃该动作）'
            : `已选择：${result.decision.label ?? ''}`
        return [{ type: 'text', text: `审批 #${short} ${outcome}` }]
      },
      // 决定内容随 tool/result 持久化：启动自愈据此恢复「已送达但未记账」的审批。
      presentationMeta: (_args: unknown, value: unknown) => {
        const result = value as {
          approvalId: string
          decidedAt: number
          decision: {
            kind: 'selected' | 'skipped'
            index?: number
            label?: string
            note?: string
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
            ...(decision.note === undefined ? {} : { note: decision.note }),
          },
        }
      },
    },
    execute: async (rawArgs: unknown, exec: ToolRunContext) => {
      const args = parseApprovalSubmitArgs(rawArgs)
      const sessionId = exec.agent?.session.id
      if (sessionId === undefined) {
        throw new ApprovalSubmitError('无法确定调用该工具的会话', 'no-active-ticket')
      }
      const ticket = findActiveTicket(deps, args.ticketId, sessionId)
      if (ticket === undefined) {
        throw new ApprovalSubmitError('当前会话没有进行中的工单', 'no-active-ticket')
      }
      const attachments = resolveAttachments(args.attachments, ticket.directory)

      const approvalId = createApprovalId()
      const resolver = deps.resolvers.create(approvalId)
      deps.store.append({
        type: 'approval/pending',
        actor: 'worker',
        correlationId: ticket.id,
        sessionId,
        payload: {
          approvalId,
          ticketId: ticket.id,
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
  const { kind, index, label, note } = delivery.decision
  return {
    approvalId,
    decision:
      kind === 'selected'
        ? { kind, index, label }
        : { kind: 'skipped' },
    ...(note === undefined ? {} : { note }),
    decidedAt: delivery.decidedAt,
  }
}

/** 当前会话绑定的进行中工单；显式 ticketId 必须属于该会话。 */
function findActiveTicket(
  deps: ApprovalSubmitDependencies,
  ticketId: string | undefined,
  sessionId: SessionId,
): { id: string; directory?: string } | undefined {
  return deps.store
    .projection()
    .tickets.find(
      ticket =>
        (ticketId === undefined || ticket.id === ticketId) &&
        ticket.workerSessionId === sessionId &&
        ticket.stage !== 'ended',
    )
}

/**
 * 把 worker 给的附件归一成绝对路径。
 *
 * 相对路径只相对于工单工作目录才有意义，而只有 Host 知道那个目录；
 * 解析不了就当场失败，而不是留给卡片去猜一个打不开的地址。
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
        `附件 ${path} 是相对路径，但该工单没有工作目录；请给出绝对路径`,
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
