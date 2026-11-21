// src/shared/settings.ts
//
// 设置页的共享契约：三份提示词、派单规则、执行器配置，以及两端共用的收窄与
// 装配纯函数。文件读写、模型目录与 HTTP 分别是 Host / Client 的实现细节，
// 不放在这里。

/** 三份提示词：共享约定同时进入 Router 与 Worker，角色文本只进入对应角色。 */
export const PROMPT_PARTS = ['shared', 'router', 'worker'] as const

export type PromptPart = (typeof PROMPT_PARTS)[number]

export interface PromptTexts {
  shared: string
  router: string
  worker: string
}

/** 设置输入的硬边界；Host 用同一份常量拒绝越界请求。 */
export const PROMPT_LIMITS = {
  promptPart: 32_000,
  ruleName: 40,
  ruleInstruction: 500,
  rules: 50,
} as const

/** 一条派单规则；只有启用项进入 Router 的提示词。 */
export interface DispatchRule {
  id: string
  name: string
  instruction: string
  enabled: boolean
}

/** 并行工单数的契约范围与缺省值。 */
export const MAX_WORKERS = {
  min: 1,
  max: 100,
  defaultValue: 5,
} as const

/** 一个可路由的模型选择；三字段都来自官方模型目录。 */
export interface WorkerModel {
  provider: string
  model: string
  reasoningEffort?: string
}

/** 执行器配置：模型缺省表示继承 DSH 默认，根目录缺省表示 `<state>/work`。 */
export interface ExecutorSettings {
  maxWorkers: number
  model: WorkerModel | null
  rootDirectory: string | null
}

/** 官方模型目录里的一个模型；`reasoning` 只在适配器声明推理强度时存在。 */
export interface ModelOption {
  id: string
  name: string
  reasoning?: {
    efforts: readonly { id: string; name: string }[]
    defaultEffort?: string
  }
}

export interface ModelProviderOption {
  id: string
  name: string
  models: readonly ModelOption[]
}

export interface ModelCatalogFailure {
  id: string
  name: string
  message: string
}

/** 模型目录视图：默认选择、可路由的服务商，以及各自失败的来源。 */
export interface ModelCatalogView {
  default: WorkerModel | null
  providers: readonly ModelProviderOption[]
  failures: readonly ModelCatalogFailure[]
}

/** 一个提示词版本的摘要，用于历史列表。 */
export interface PromptVersionSummary {
  revision: number
  savedAt: string
  source: 'defaults' | 'panel'
  /** 三份文本的段落总数。 */
  parts: number
  /** 三份文本的字符总数。 */
  chars: number
}

export interface PromptVersion extends PromptVersionSummary {
  texts: PromptTexts
}

/** 设置页一次读取所需的全部状态。 */
export interface SettingsView {
  /** 执行器与规则的修订号，保存时用于乐观锁。 */
  revision: number
  executor: ExecutorSettings
  /** 根目录留空时 Host 实际使用的目录。 */
  defaultRoot: string
  policy: {
    /** 派单规则：只进入 Router 的提示词。 */
    rules: DispatchRule[]
    /** 规则集与权限集的共同指纹，前 8 位十六进制。 */
    version: string
    /** 决策权限：只进入 Worker 的提示词。 */
    permissions: DispatchRule[]
  }
  prompts: {
    current: PromptVersion
    defaults: PromptTexts
    /** 已保存版本，新到旧；不含内置默认（它在 `defaults`）。 */
    history: PromptVersionSummary[]
  }
  models: ModelCatalogView
}

export interface ExecutorSaveRequest {
  executor: ExecutorSettings
  revision: number
}

export interface PolicySaveRequest {
  rules: DispatchRule[]
  permissions: DispatchRule[]
  revision: number
}

export interface PromptSaveRequest {
  texts: PromptTexts
  baseRevision: number
}

export interface SettingsSaveResponse {
  ok: true
  revision: number
  /** 派单规则与决策权限此刻的共同指纹。 */
  policyVersion: string
}

export interface PromptSaveResponse {
  ok: true
  version: PromptVersionSummary
}

/** 把换行压成空格：一条规则只能占一行，不能伪造标题或列表项。 */
function oneLine(text: string): string {
  return text.replace(/\s*\n\s*/g, ' ').trim()
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** 统计非空段落数；空行与只含空白的行都算分隔。 */
export function countParagraphs(text: string): number {
  return text
    .replaceAll('\r\n', '\n')
    .replaceAll('\r', '\n')
    .split(/\n[ \t]*\n+/)
    .map(paragraph => paragraph.trim())
    .filter(paragraph => paragraph.length > 0).length
}

export function promptStats(texts: PromptTexts): { parts: number; chars: number } {
  return {
    parts: PROMPT_PARTS.reduce((sum, part) => sum + countParagraphs(texts[part]), 0),
    chars: texts.shared.length + texts.router.length + texts.worker.length,
  }
}

export function activeRules(rules: readonly DispatchRule[]): DispatchRule[] {
  return rules.filter(rule => rule.enabled)
}

/**
 * 规则 id 的确定性生成：同一条规则在客户端新增、Host 校验两侧得到同一个 id，
 * 不依赖随机数；完全相同的两条规则会得到同一 id，由收窄函数判为重复。
 */
export function ruleIdOf(name: string, instruction: string): string {
  let hash = 0x811c9dc5
  const input = `${name}\n${instruction}`
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return `rule-${hash.toString(16).padStart(8, '0')}`
}

/**
 * 把规则列表收窄成可持久化的形状。
 *
 * id 允许缺省或格式非法（例如客户端生成失败），此时按内容派生；显式给出的合法
 * id 原样保留，这样改说明不会让一条已存在的规则换 id。
 */
export function parseDispatchRules(value: unknown): DispatchRule[] {
  if (!Array.isArray(value)) throw new Error('规则列表必须是一个数组')
  if (value.length > PROMPT_LIMITS.rules) {
    throw new Error(`规则列表最多 ${PROMPT_LIMITS.rules} 条`)
  }

  const seen = new Set<string>()
  return value.map((item, index) => {
    if (!isRecord(item)) throw new Error(`第 ${index + 1} 条规则必须是对象`)
    const name = typeof item.name === 'string' ? item.name.trim() : ''
    const instruction = typeof item.instruction === 'string' ? item.instruction.trim() : ''
    if (name.length === 0) throw new Error(`第 ${index + 1} 条规则的名称不能为空`)
    if (name.length > PROMPT_LIMITS.ruleName) {
      throw new Error(`第 ${index + 1} 条规则的名称超过 ${PROMPT_LIMITS.ruleName} 个字符`)
    }
    if (instruction.length === 0) throw new Error(`第 ${index + 1} 条规则的说明不能为空`)
    if (instruction.length > PROMPT_LIMITS.ruleInstruction) {
      throw new Error(`第 ${index + 1} 条规则的说明超过 ${PROMPT_LIMITS.ruleInstruction} 个字符`)
    }
    if (typeof item.enabled !== 'boolean') throw new Error(`第 ${index + 1} 条规则的开关必须是布尔值`)

    const explicit = typeof item.id === 'string' && /^[a-z0-9][a-z0-9-]{0,39}$/.test(item.id) ? item.id : undefined
    const id = explicit ?? ruleIdOf(name, instruction)
    if (seen.has(id)) throw new Error(`规则 id 重复：${id}`)
    seen.add(id)
    return { id, name, instruction, enabled: item.enabled }
  })
}

/** 把三份提示词收窄；首尾空白不算内容，内部换行原样保留。 */
export function parsePromptTexts(value: unknown): PromptTexts {
  if (!isRecord(value)) throw new Error('提示词必须是一个对象')
  const texts = {} as PromptTexts
  for (const part of PROMPT_PARTS) {
    const raw = value[part]
    if (typeof raw !== 'string') throw new Error(`提示词缺少 ${part}`)
    const text = raw.trim()
    if (text.length === 0) throw new Error(`提示词 ${part} 不能为空`)
    if (text.length > PROMPT_LIMITS.promptPart) {
      throw new Error(`提示词 ${part} 超过 ${PROMPT_LIMITS.promptPart} 个字符`)
    }
    texts[part] = text
  }
  return texts
}

/** 绝对路径判定：盘符、UNC 与 POSIX 根都算；`C:work` 与相对路径不算。 */
export function isAbsoluteDirectory(path: string): boolean {
  if (path.length === 0) return false
  if (path.startsWith('\\\\')) return true
  if (/^[A-Za-z]:[\\/]/.test(path)) return true
  return path.startsWith('/')
}

function parseWorkerModel(value: unknown): WorkerModel | null {
  if (value === undefined || value === null) return null
  if (!isRecord(value)) throw new Error('执行器模型必须是对象或空')
  const provider = typeof value.provider === 'string' ? value.provider.trim() : ''
  const model = typeof value.model === 'string' ? value.model.trim() : ''
  if (provider.length === 0) throw new Error('执行器模型缺少服务商')
  if (model.length === 0) throw new Error('执行器模型缺少模型')
  if (value.reasoningEffort === undefined || value.reasoningEffort === null) return { provider, model }
  if (typeof value.reasoningEffort !== 'string' || value.reasoningEffort.trim().length === 0) {
    throw new Error('执行器模型的推理强度必须是非空字符串')
  }
  return { provider, model, reasoningEffort: value.reasoningEffort.trim() }
}

function parseRootDirectory(value: unknown): string | null {
  if (value === undefined || value === null) return null
  if (typeof value !== 'string') throw new Error('执行环境根目录必须是字符串或空')
  const path = value.trim()
  if (path.length === 0) return null
  if (!isAbsoluteDirectory(path)) throw new Error(`执行环境根目录必须是绝对路径：${path}`)
  return path
}

/** 收窄执行器设置：缺省的并行数取默认值，模型与根目录的空值统一为 `null`。 */
export function parseExecutorSettings(value: unknown): ExecutorSettings {
  if (!isRecord(value)) throw new Error('执行器设置必须是一个对象')
  const raw = value.maxWorkers === undefined ? MAX_WORKERS.defaultValue : value.maxWorkers
  if (
    typeof raw !== 'number' ||
    !Number.isInteger(raw) ||
    raw < MAX_WORKERS.min ||
    raw > MAX_WORKERS.max
  ) {
    throw new Error(`并行工单数必须是 ${MAX_WORKERS.min} 到 ${MAX_WORKERS.max} 的整数`)
  }
  return {
    maxWorkers: raw,
    model: parseWorkerModel(value.model),
    rootDirectory: parseRootDirectory(value.rootDirectory),
  }
}

/** 模型选择的展示文本；没有配置时为空串，由界面决定显示哪条继承文案。 */
export function formatWorkerModel(model: WorkerModel | null): string {
  if (model === null) return ''
  const effort = model.reasoningEffort === undefined ? '' : ` · ${model.reasoningEffort}`
  return `${model.provider} / ${model.model}${effort}`
}

/** 把启用规则渲染成提示词里的一段；标题与版本行由调用方给出。 */
function composeRuleSection(
  heading: string,
  versionLabel: string,
  rules: readonly DispatchRule[],
  version?: string,
): string {
  const enabled = activeRules(rules)
  if (enabled.length === 0) return ''
  const lines = [heading]
  if (version !== undefined && version.length > 0) lines.push(`${versionLabel} ${version}`)
  for (const rule of enabled) {
    lines.push(`- ${oneLine(rule.name)}：${oneLine(rule.instruction)}`)
  }
  return lines.join('\n')
}

/** 派单规则段：只进入 Router，决定什么该交给执行会话。 */
export function composeDispatchSection(
  rules: readonly DispatchRule[],
  policyVersion?: string,
): string {
  return composeRuleSection('## 派单规则', '策略版本', rules, policyVersion)
}

/** 决策权限段：只进入 Worker，决定什么该提交审批、什么可以自己决定。 */
export function composePermissionSection(
  rules: readonly DispatchRule[],
  policyVersion?: string,
): string {
  return composeRuleSection('## 决策权限', '策略版本', rules, policyVersion)
}

/** 角色提示词里由设置提供的两套规则及其共同版本。 */
export interface RolePromptPolicy {
  dispatchRules?: readonly DispatchRule[]
  permissions?: readonly DispatchRule[]
  /** 两套规则共用的策略版本；两段提示词都标同一个版本。 */
  policyVersion?: string
}

/** 一个角色最终读到的提示词：共享约定 + 角色文本 + 该角色专属的规则段。 */
export function composeRolePrompt(
  texts: PromptTexts,
  role: 'router' | 'worker',
  policy: RolePromptPolicy = {},
): string {
  const base = [texts.shared.trim(), texts[role].trim()].filter(text => text.length > 0).join('\n\n')
  const section =
    role === 'router'
      ? composeDispatchSection(policy.dispatchRules ?? [], policy.policyVersion)
      : composePermissionSection(policy.permissions ?? [], policy.policyVersion)
  return section.length === 0 ? base : `${base}\n\n${section}`
}
