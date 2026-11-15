// src/host/tools/pa_approval_submit/index.ts
//
// worker 的审批工具：写入 approval/pending 后**阻塞**等待人的决定。
// 决定先送达本工具，工具确认已收到（acknowledge）之后，服务端才写
// approval/decided —— 这是「先送达、后记账」的实现位置（方案 §6.2）。

import { HarnessError } from '@deepseek-ai/dsh-llm'
import type { SessionId } from '@deepseek-ai/dsh-session'
import type { ToolDefinition, ToolRunContext } from '@deepseek-ai/dsh-tools'
import {
  APPROVAL_FIELD_TYPES,
  APPROVAL_RISKS,
  type ApprovalField,
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
  title: string
  question: string
  options: ApprovalOption[]
  fields?: ApprovalField[]
  risk?: ApprovalRisk
  ticketId?: string
}

export function parseApprovalSubmitArgs(raw: unknown): ApprovalSubmitArgs {
  if (!isRecord(raw)) throw new ApprovalSubmitError('参数必须是一个对象', 'invalid-arguments')
  const title = requiredText(raw.title, 'title')
  if ([...title].length > 40) {
    throw new ApprovalSubmitError(`title 最多 40 个字符（当前 ${[...title].length} 个）`, 'invalid-arguments')
  }
  const question = requiredText(raw.question, 'question')
  const options = parseOptions(raw.options)
  const args: ApprovalSubmitArgs = { title, question, options }
  if (raw.fields !== undefined) args.fields = parseFields(raw.fields)
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
      '需要人类决定时使用：提交一个审批并等待决定。调用会一直阻塞到有人处理，返回决定内容后按决定继续。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['title', 'question', 'options'],
      properties: {
        title: { type: 'string', minLength: 1, maxLength: 40, description: '一句话：要批准什么。' },
        question: { type: 'string', minLength: 1, description: '详细说明：背景、每个选项的含义与后果。' },
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
        fields: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['key', 'label', 'type'],
            properties: {
              key: { type: 'string', minLength: 1 },
              label: { type: 'string', minLength: 1 },
              type: { type: 'string', enum: ['text', 'textarea', 'number', 'boolean'] },
              required: { type: 'boolean' },
            },
          },
          description: '需要人填写的字段。',
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
          fields: { type: 'object' },
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
            fields?: Record<string, string | number | boolean>
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
            ...(decision.fields === undefined ? {} : { fields: decision.fields }),
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
          title: args.title,
          question: args.question,
          options: args.options,
          requestedBySessionId: sessionId,
          ...(args.fields === undefined ? {} : { fields: args.fields }),
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
  const { kind, index, label, note, fields } = delivery.decision
  return {
    approvalId,
    decision:
      kind === 'selected'
        ? { kind, index, label }
        : { kind: 'skipped' },
    ...(note === undefined ? {} : { note }),
    ...(fields === undefined ? {} : { fields }),
    decidedAt: delivery.decidedAt,
  }
}

/** 当前会话绑定的进行中工单；显式 ticketId 必须属于该会话。 */
function findActiveTicket(
  deps: ApprovalSubmitDependencies,
  ticketId: string | undefined,
  sessionId: SessionId,
): { id: string } | undefined {
  return deps.store
    .projection()
    .tickets.find(
      ticket =>
        (ticketId === undefined || ticket.id === ticketId) &&
        ticket.workerSessionId === sessionId &&
        ticket.stage !== 'ended',
    )
}

function waitForDelivery(resolver: PendingResolver, signal: AbortSignal): Promise<ApprovalDelivery> {
  if (signal.aborted) {
    resolver.cancel()
    return Promise.reject(new ApprovalCancelledError())
  }
  return new Promise<ApprovalDelivery>((resolve, reject) => {
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

function parseFields(value: unknown): ApprovalField[] {
  if (!Array.isArray(value)) {
    throw new ApprovalSubmitError('fields 必须是数组', 'invalid-arguments')
  }
  const seen = new Set<string>()
  return value.map((field, index) => {
    if (!isRecord(field)) {
      throw new ApprovalSubmitError(`fields[${index}] 必须是对象`, 'invalid-arguments')
    }
    const key = requiredText(field.key, `fields[${index}].key`)
    if (seen.has(key)) {
      throw new ApprovalSubmitError(`fields[${index}].key 重复：${key}`, 'invalid-arguments')
    }
    seen.add(key)
    const label = requiredText(field.label, `fields[${index}].label`)
    if (!APPROVAL_FIELD_TYPES.includes(field.type as (typeof APPROVAL_FIELD_TYPES)[number])) {
      throw new ApprovalSubmitError(
        `fields[${index}].type 必须是 ${APPROVAL_FIELD_TYPES.join('、')} 之一`,
        'invalid-arguments',
      )
    }
    const parsed: ApprovalField = {
      key,
      label,
      type: field.type as ApprovalField['type'],
    }
    if (field.required !== undefined) {
      if (typeof field.required !== 'boolean') {
        throw new ApprovalSubmitError(`fields[${index}].required 必须是布尔值`, 'invalid-arguments')
      }
      parsed.required = field.required
    }
    return parsed
  })
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
