// src/host/settings/service.ts
//
// 设置服务的业务面：一次视图、三类保存、提示词装配与执行器派生值。
// 输入在这里收窄成契约形状；存储只负责持久化与 revision，模型目录只负责
// 投影官方能力，三方各自边界清晰。

import { join } from 'node:path'
import {
  composeRolePrompt,
  parseDispatchRules,
  parseExecutorSettings,
  parsePromptTexts,
  type DispatchRule,
  type ModelCatalogView,
  type PromptSaveResponse,
  type PromptTexts,
  type PromptVersion,
  type SettingsSaveResponse,
  type SettingsView,
  type WorkerModel,
} from '../../shared/settings.ts'
import { PromptRevisionNotFoundError, SettingsInputError } from './errors.ts'
import { policyVersionOf } from './policy.ts'
import type { SettingsStore } from './store.ts'

/** 历史列表一次给多少条；更早的版本仍在磁盘上，事件页不承担翻页。 */
const HISTORY_LIMIT = 50

export interface SettingsServiceOptions {
  store: SettingsStore
  /** 状态目录，用于算出执行环境根目录的缺省值。 */
  stateDirectory: string
  /** 模型目录构建；异步，因为官方目录要按服务商逐个读取。 */
  modelCatalog: () => Promise<ModelCatalogView>
}

export interface SettingsService {
  /** 总控台设置页一次读取所需的全部状态。 */
  view(): Promise<SettingsView>
  saveExecutor(input: unknown): Promise<SettingsSaveResponse>
  savePolicy(input: unknown): Promise<SettingsSaveResponse>
  savePrompts(input: unknown): Promise<PromptSaveResponse>
  /** 版本 0 是内置默认；不存在的版本抛 `PromptRevisionNotFoundError`。 */
  promptVersion(revision: number): PromptVersion
  promptTexts(): PromptTexts
  /** 派单规则：只进入 Router。 */
  rules(): DispatchRule[]
  policyVersion(): string
  /** 决策权限：只进入 Worker。 */
  permissions(): DispatchRule[]
  permissionVersion(): string
  /** 某个角色下一次模型请求读到的完整提示词。 */
  composePrompt(role: 'router' | 'worker'): string
  maxWorkers(): number
  workerModel(): WorkerModel | null
  /** 执行环境根目录；配置为空时是 `<state>/work`。 */
  executorRoot(): string
}

export function createSettingsService(options: SettingsServiceOptions): SettingsService {
  const { store, stateDirectory, modelCatalog } = options

  const rules = (): DispatchRule[] => store.snapshot().rules
  const permissions = (): DispatchRule[] => store.snapshot().permissions
  const policyVersion = (): string => policyVersionOf(rules())
  const permissionVersion = (): string => policyVersionOf(permissions())

  async function view(): Promise<SettingsView> {
    const snapshot = store.snapshot()
    const defaults = store.promptVersion(0)
    if (defaults === undefined) throw new Error('settings store lost its default prompt version')
    return {
      revision: snapshot.revision,
      executor: snapshot.executor,
      defaultRoot: join(stateDirectory, 'work'),
      policy: {
        rules: snapshot.rules,
        version: policyVersionOf(snapshot.rules),
        permissions: snapshot.permissions,
        permissionVersion: policyVersionOf(snapshot.permissions),
      },
      prompts: {
        current: store.promptSummaryVersion(),
        defaults: defaults.texts,
        history: store.promptHistory(HISTORY_LIMIT),
      },
      models: await modelCatalog(),
    }
  }

  async function saveExecutor(input: unknown): Promise<SettingsSaveResponse> {
    const body = readBody(input)
    const revision = readRevision(body.revision)
    const executor = narrow(() => parseExecutorSettings(body.executor))
    const next = await store.saveExecutor(executor, revision)
    return {
      ok: true,
      revision: next,
      policyVersion: policyVersionOf(store.snapshot().rules),
      permissionVersion: policyVersionOf(store.snapshot().permissions),
    }
  }

  async function savePolicy(input: unknown): Promise<SettingsSaveResponse> {
    const body = readBody(input)
    const revision = readRevision(body.revision)
    const parsed = narrow(() => parseDispatchRules(body.rules))
    // 决策权限与派单规则同构；旧请求没有这一项时按空集保存。
    const parsedPermissions = narrow(() => parseDispatchRules(body.permissions ?? []))
    const next = await store.savePolicy(parsed, parsedPermissions, revision)
    return {
      ok: true,
      revision: next,
      policyVersion: policyVersionOf(store.snapshot().rules),
      permissionVersion: policyVersionOf(store.snapshot().permissions),
    }
  }

  async function savePrompts(input: unknown): Promise<PromptSaveResponse> {
    const body = readBody(input)
    const baseRevision = readRevision(body.baseRevision)
    const texts = narrow(() => parsePromptTexts(body.texts))
    const version = await store.savePrompts(texts, baseRevision)
    const { texts: _texts, ...summary } = version
    return { ok: true, version: summary }
  }

  function promptVersion(revision: number): PromptVersion {
    if (!Number.isInteger(revision) || revision < 0) throw new PromptRevisionNotFoundError(revision)
    const version = store.promptVersion(revision)
    if (version === undefined) throw new PromptRevisionNotFoundError(revision)
    return version
  }

  return {
    view,
    saveExecutor,
    savePolicy,
    savePrompts,
    promptVersion,
    promptTexts: () => store.promptTexts(),
    rules,
    policyVersion,
    permissions,
    permissionVersion,
    composePrompt: role =>
      composeRolePrompt(store.promptTexts(), role, {
        dispatchRules: rules(),
        dispatchVersion: policyVersion(),
        permissions: permissions(),
        permissionVersion: permissionVersion(),
      }),
    maxWorkers: () => store.snapshot().executor.maxWorkers,
    workerModel: () => store.snapshot().executor.model,
    executorRoot: () => store.snapshot().executor.rootDirectory ?? join(stateDirectory, 'work'),
  }
}

function readBody(input: unknown): Record<string, unknown> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new SettingsInputError('请求体必须是对象')
  }
  return input as Record<string, unknown>
}

function readRevision(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new SettingsInputError('revision 必须是非负整数')
  }
  return value
}

/** 把契约收窄函数的普通错误换成稳定输入错误，协议层只按类别分支。 */
function narrow<T>(parse: () => T): T {
  try {
    return parse()
  } catch (error) {
    throw new SettingsInputError(error instanceof Error ? error.message : String(error))
  }
}
