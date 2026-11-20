// src/client/lib/settings.ts
//
// 设置页的纯逻辑：行级 diff、草稿校验、模型候选推导、完整提示词拼装。
// 组件只消费这些结果；这里不依赖 React，也不发请求。

import {
  MAX_WORKERS,
  PROMPT_LIMITS,
  composeRolePrompt,
  isAbsoluteDirectory,
  type DispatchRule,
  type ExecutorSettings,
  type ModelCatalogView,
  type PromptTexts,
  type WorkerModel,
} from '../../shared/settings.ts'

/** 一行 diff：同一行、新增、删除，或一段被折叠的相同行。 */
export type DiffLine =
  | { kind: 'same'; text: string }
  | { kind: 'ins'; text: string }
  | { kind: 'del'; text: string }
  | { kind: 'fold'; count: number }

/** 矩阵上限：超过就整段替换，避免长提示词把浏览器卡死。 */
const MAX_DIFF_CELLS = 400_000

function splitLines(text: string): string[] {
  if (text.length === 0) return []
  return text.replaceAll('\r\n', '\n').split('\n')
}

function foldSame(ops: DiffLine[], context: number): DiffLine[] {
  const result: DiffLine[] = []
  let index = 0
  while (index < ops.length) {
    const op = ops[index]
    if (op === undefined) break
    if (op.kind !== 'same') {
      result.push(op)
      index += 1
      continue
    }
    let end = index
    while (end < ops.length && ops[end]?.kind === 'same') end += 1
    const run = end - index
    if (run > context * 2 + 1) {
      for (let offset = 0; offset < context; offset += 1) {
        const head = ops[index + offset]
        if (head !== undefined) result.push(head)
      }
      result.push({ kind: 'fold', count: run - context * 2 })
      for (let offset = end - context; offset < end; offset += 1) {
        const tail = ops[offset]
        if (tail !== undefined) result.push(tail)
      }
    } else {
      for (let offset = index; offset < end; offset += 1) {
        const item = ops[offset]
        if (item !== undefined) result.push(item)
      }
    }
    index = end
  }
  return result
}

/**
 * 逐行 diff（LCS）；`context` 是每个变更两侧保留的相同行数，中间的相同段折叠。
 *
 * 文本很大时退化为「整段删除 + 整段新增」：结果仍可读，但不会分配一个巨型矩阵。
 */
export function diffLines(base: string, next: string, context = 2): DiffLine[] {
  const before = splitLines(base)
  const after = splitLines(next)
  if (before.length === 0) return after.map(text => ({ kind: 'ins', text }))
  if (after.length === 0) return before.map(text => ({ kind: 'del', text }))
  if (before.length * after.length > MAX_DIFF_CELLS) {
    return [
      ...before.map(text => ({ kind: 'del' as const, text })),
      ...after.map(text => ({ kind: 'ins' as const, text })),
    ]
  }

  const width = after.length + 1
  const table = new Uint32Array((before.length + 1) * width)
  for (let row = before.length - 1; row >= 0; row -= 1) {
    for (let column = after.length - 1; column >= 0; column -= 1) {
      table[row * width + column] =
        before[row] === after[column]
          ? table[(row + 1) * width + column + 1]! + 1
          : Math.max(table[(row + 1) * width + column]!, table[row * width + column + 1]!)
    }
  }

  const ops: DiffLine[] = []
  let row = 0
  let column = 0
  while (row < before.length && column < after.length) {
    const current = before[row]
    if (current === after[column]) {
      ops.push({ kind: 'same', text: current ?? '' })
      row += 1
      column += 1
    } else if (table[(row + 1) * width + column]! >= table[row * width + column + 1]!) {
      ops.push({ kind: 'del', text: current ?? '' })
      row += 1
    } else {
      ops.push({ kind: 'ins', text: after[column] ?? '' })
      column += 1
    }
  }
  while (row < before.length) {
    ops.push({ kind: 'del', text: before[row] ?? '' })
    row += 1
  }
  while (column < after.length) {
    ops.push({ kind: 'ins', text: after[column] ?? '' })
    column += 1
  }
  return foldSame(ops, context)
}

/** 一条草稿规则的 id：客户端生成、稳定到保存，服务端收窄时原样保留。 */
export function newRuleId(existing: readonly DispatchRule[], now = Date.now()): string {
  let counter = 0
  for (;;) {
    const candidate = `rule-${now.toString(36).slice(-6)}${counter.toString(36)}`
    if (!existing.some(rule => rule.id === candidate)) return candidate
    counter += 1
  }
}

export type RuleDraftError =
  | 'nameRequired'
  | 'nameTooLong'
  | 'instructionRequired'
  | 'instructionTooLong'
  | 'duplicateId'

/** 规则草稿的即时校验；文案由组件按错误码从词典取。 */
export function ruleDraftError(
  draft: DispatchRule,
  all: readonly DispatchRule[],
): RuleDraftError | undefined {
  const name = draft.name.trim()
  const instruction = draft.instruction.trim()
  if (name.length === 0) return 'nameRequired'
  if (name.length > PROMPT_LIMITS.ruleName) return 'nameTooLong'
  if (instruction.length === 0) return 'instructionRequired'
  if (instruction.length > PROMPT_LIMITS.ruleInstruction) return 'instructionTooLong'
  if (all.filter(rule => rule.id === draft.id).length > 1) return 'duplicateId'
  return undefined
}

/** 执行器表单的草稿：并行数保留输入原文，保存时才转数字。 */
export interface ExecutorDraft {
  maxWorkers: string
  model: WorkerModel | null
  rootDirectory: string
}

export type ExecutorDraftError = 'maxWorkersInvalid' | 'rootNotAbsolute' | 'modelIncomplete'

export function executorDraftError(draft: ExecutorDraft): ExecutorDraftError | undefined {
  const maxWorkers = Number(draft.maxWorkers)
  if (
    draft.maxWorkers.trim().length === 0 ||
    !Number.isInteger(maxWorkers) ||
    maxWorkers < MAX_WORKERS.min ||
    maxWorkers > MAX_WORKERS.max
  ) {
    return 'maxWorkersInvalid'
  }
  const root = draft.rootDirectory.trim()
  if (root.length > 0 && !isAbsoluteDirectory(root)) return 'rootNotAbsolute'
  if (
    draft.model !== null &&
    (draft.model.provider.trim().length === 0 || draft.model.model.trim().length === 0)
  ) {
    return 'modelIncomplete'
  }
  return undefined
}

/** 把草稿转成契约值；调用前应已通过 `executorDraftError`。 */
export function executorDraftValue(draft: ExecutorDraft): ExecutorSettings {
  const root = draft.rootDirectory.trim()
  return {
    maxWorkers: Number(draft.maxWorkers),
    model: draft.model,
    rootDirectory: root.length === 0 ? null : root,
  }
}

/** 某个模型可选的推理强度；模型不存在或不支持时为空。 */
export function reasoningOptions(
  catalog: ModelCatalogView,
  model: WorkerModel | null,
): { id: string; name: string }[] {
  if (model === null) return []
  const provider = catalog.providers.find(item => item.id === model.provider)
  const option = provider?.models.find(item => item.id === model.model)
  return option?.reasoning?.efforts.map(effort => ({ id: effort.id, name: effort.name })) ?? []
}

/** 已保存的模型是否仍在目录中；没有选择（继承默认）永远视为可用。 */
export function modelAvailable(catalog: ModelCatalogView, model: WorkerModel | null): boolean {
  if (model === null) return true
  return catalog.providers.some(
    provider =>
      provider.id === model.provider && provider.models.some(option => option.id === model.model),
  )
}

/** 某个角色最终读到的完整提示词；与 Host 装配用的是同一个共享函数。 */
export function promptFullText(
  texts: PromptTexts,
  role: 'router' | 'worker',
  rules: readonly DispatchRule[],
  policyVersion: string,
): string {
  return composeRolePrompt(texts, role, rules, policyVersion)
}

export function isSamePromptTexts(left: PromptTexts, right: PromptTexts): boolean {
  return left.shared === right.shared && left.router === right.router && left.worker === right.worker
}

/** 执行器配置的字段级比较：用来判断草稿是否真的有改动。 */
export function isSameExecutor(left: ExecutorSettings, right: ExecutorSettings): boolean {
  if (left.maxWorkers !== right.maxWorkers) return false
  if (left.rootDirectory !== right.rootDirectory) return false
  if (left.model === null || right.model === null) return left.model === right.model
  return (
    left.model.provider === right.model.provider &&
    left.model.model === right.model.model &&
    left.model.reasoningEffort === right.model.reasoningEffort
  )
}
