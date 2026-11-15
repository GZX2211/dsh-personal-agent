// src/host/store/payload-spec.ts
//
// 已知事件类型的载荷契约（运行时）。账本方是本仓库唯一的数据来源，所以读取一侧
// 必须能独立判断「一行载荷是否还符合当前版本」，不能只靠生产者的类型。

import {
  APPROVAL_DECISION_KINDS,
  APPROVAL_FIELD_TYPES,
  APPROVAL_RISKS,
  APPROVAL_TRANSPORTS,
} from '../../shared/approvals.ts'
import {
  APPROVAL_DISCARD_REASONS,
  DECISION_ACTIONS,
  EVENT_TYPES,
  REPORT_STATUSES,
  SIGNAL_KINDS,
  TASK_INTERRUPT_REASONS,
  TASK_MODES,
  type EventType,
} from '../../shared/events.ts'
import { QUEUE_REASONS, TICKET_OUTCOMES } from '../../shared/tickets.ts'

type FieldRule =
  | { type: 'string' }
  | { type: 'number' }
  | { type: 'boolean' }
  | { type: 'enum'; values: readonly string[] }
  | { type: 'strings' }
  | { type: 'options' }
  | { type: 'fields' }
  | { type: 'decision' }

interface PayloadSpec {
  required: Record<string, FieldRule>
  optional?: Record<string, FieldRule>
}

/**
 * 各类事件的必填与可选字段。
 *
 * 新增载荷字段必须可选：旧账本行不会被重写，把新字段设为必填会让历史账本
 * 在升级后变成「损坏」。
 */
const PAYLOAD_SPECS: Record<EventType, PayloadSpec> = {
  [EVENT_TYPES.signalReceived]: {
    required: {
      kind: { type: 'enum', values: SIGNAL_KINDS },
      delivered: { type: 'boolean' },
      receivedAt: { type: 'number' },
    },
    optional: {
      sourceId: { type: 'string' },
      externalId: { type: 'string' },
      text: { type: 'string' },
      rule: { type: 'string' },
    },
  },
  [EVENT_TYPES.decisionRecorded]: {
    required: { action: { type: 'enum', values: DECISION_ACTIONS } },
    optional: { inferred: { type: 'boolean' }, reason: { type: 'string' }, ticketId: { type: 'string' } },
  },
  [EVENT_TYPES.taskQueued]: {
    required: {
      ticketId: { type: 'string' },
      title: { type: 'string' },
      goal: { type: 'string' },
      mode: { type: 'enum', values: TASK_MODES },
    },
    optional: {
      workerSessionId: { type: 'string' },
      context: { type: 'string' },
      constraints: { type: 'strings' },
      expectedOutput: { type: 'string' },
      directory: { type: 'string' },
      queueReason: { type: 'enum', values: QUEUE_REASONS },
      requestedBySessionId: { type: 'string' },
    },
  },
  [EVENT_TYPES.taskDispatched]: {
    required: {
      ticketId: { type: 'string' },
      workerSessionId: { type: 'string' },
      mode: { type: 'enum', values: TASK_MODES },
    },
    optional: { directory: { type: 'string' } },
  },
  [EVENT_TYPES.taskInterrupted]: {
    required: {
      ticketId: { type: 'string' },
      turn: { type: 'number' },
      reason: { type: 'enum', values: TASK_INTERRUPT_REASONS },
    },
  },
  [EVENT_TYPES.taskResumed]: {
    required: {
      ticketId: { type: 'string' },
      turn: { type: 'number' },
    },
  },
  [EVENT_TYPES.taskReported]: {    required: {
      ticketId: { type: 'string' },
      summary: { type: 'string' },
      status: { type: 'enum', values: REPORT_STATUSES },
    },
  },
  [EVENT_TYPES.taskClosed]: {
    required: {
      ticketId: { type: 'string' },
      outcome: { type: 'enum', values: TICKET_OUTCOMES },
    },
    optional: { reason: { type: 'string' } },
  },
  [EVENT_TYPES.approvalPending]: {
    required: {
      approvalId: { type: 'string' },
      ticketId: { type: 'string' },
      title: { type: 'string' },
      question: { type: 'string' },
      options: { type: 'options' },
      requestedBySessionId: { type: 'string' },
    },
    optional: { fields: { type: 'fields' }, risk: { type: 'enum', values: APPROVAL_RISKS } },
  },
  [EVENT_TYPES.approvalDecided]: {
    required: {
      approvalId: { type: 'string' },
      decision: { type: 'decision' },
      decidedAt: { type: 'number' },
      transport: { type: 'enum', values: APPROVAL_TRANSPORTS },
    },
    optional: { recovered: { type: 'boolean' } },
  },
  [EVENT_TYPES.approvalDiscarded]: {
    required: {
      approvalId: { type: 'string' },
      reason: { type: 'enum', values: APPROVAL_DISCARD_REASONS },
      discardedAt: { type: 'number' },
    },
  },
}

/** 返回第一条不合契约的说明；全部合格时返回 undefined。 */
export function checkPayload(type: EventType, payload: Record<string, unknown>): string | undefined {
  const spec = PAYLOAD_SPECS[type]
  for (const [field, rule] of Object.entries(spec.required)) {
    if (!matches(payload[field], rule)) return `${type}.payload.${field} ${expectation(rule)}`
  }
  for (const [field, rule] of Object.entries(spec.optional ?? {})) {
    const value = payload[field]
    if (value !== undefined && !matches(value, rule)) return `${type}.payload.${field} ${expectation(rule)}`
  }
  return undefined
}

function matches(value: unknown, rule: FieldRule): boolean {
  switch (rule.type) {
    case 'string':
      return typeof value === 'string'
    case 'number':
      return typeof value === 'number' && Number.isFinite(value)
    case 'boolean':
      return typeof value === 'boolean'
    case 'enum':
      return isOneOf(value, rule.values)
    case 'strings':
      return Array.isArray(value) && value.every(item => typeof item === 'string')
    case 'options':
      return (
        Array.isArray(value) &&
        value.length > 0 &&
        value.every(option => isRecord(option) && typeof option.label === 'string' && typeof option.description === 'string')
      )
    case 'fields':
      return Array.isArray(value) && value.every(isApprovalField)
    case 'decision':
      return isApprovalDecisionRecord(value)
  }
}

function expectation(rule: FieldRule): string {
  switch (rule.type) {
    case 'enum':
      return `must be one of ${rule.values.join(', ')}`
    case 'strings':
      return 'must be an array of strings'
    case 'options':
      return 'must be a non-empty array of { label, description }'
    case 'fields':
      return 'must be an array of { key, label, type }'
    case 'decision':
      return 'must be an approval decision'
    default:
      return `must be a ${rule.type}`
  }
}

function isApprovalField(value: unknown): boolean {
  if (!isRecord(value)) return false
  if (typeof value.key !== 'string' || typeof value.label !== 'string') return false
  if (!isOneOf(value.type, APPROVAL_FIELD_TYPES)) return false
  return value.required === undefined || typeof value.required === 'boolean'
}

/** 运行时判别一份决定记录；启动自愈读取 tool/result 的 meta 时复用。 */
export function isApprovalDecisionRecord(value: unknown): boolean {
  if (!isRecord(value)) return false
  if (!isOneOf(value.kind, APPROVAL_DECISION_KINDS)) return false
  if (value.index !== undefined && !Number.isInteger(value.index)) return false
  if (value.label !== undefined && typeof value.label !== 'string') return false
  if (value.note !== undefined && typeof value.note !== 'string') return false
  if (value.fields !== undefined) {
    if (!isRecord(value.fields)) return false
    for (const field of Object.values(value.fields)) {
      if (typeof field !== 'string' && typeof field !== 'number' && typeof field !== 'boolean') return false
    }
  }
  // 选中的决定必须带下标：没有下标既解释不了选中了什么，也无法回放给 worker。
  return value.kind === 'skipped' || Number.isInteger(value.index)
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isOneOf<T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === 'string' && (values as readonly string[]).includes(value)
}
