// src/host/settings/store.ts
//
// 设置的持久化边界：`settings.json` 存执行器与派单规则（允许改写），
// `prompt-history.jsonl` 只追加提示词版本（不可变）。两份文件分开，提示词
// 保存不会重置执行器配置，执行器保存也不会产生一个提示词版本。
//
// revision 是乐观锁：保存必须带上是哪一版改的，旧基准一律拒绝。读取损坏时
// 降级为默认值并告警——设置读不出来不该让插件起不来，也不该删用户文件。

import { appendFile, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  MAX_WORKERS,
  parseDispatchRules,
  parseExecutorSettings,
  parsePromptTexts,
  promptStats,
  type DispatchRule,
  type ExecutorSettings,
  type PromptTexts,
  type PromptVersion,
  type PromptVersionSummary,
} from '../../shared/settings.ts'
import { ensureDirectory } from '../state/directory.ts'

const SETTINGS_FILE = 'settings.json'
const HISTORY_FILE = 'prompt-history.jsonl'

/** 设置文件的结构版本；将来改变形状时用它判断旧数据。 */
const SETTINGS_FORMAT = 1

/** 保存在旧设置修订之上：执行器或规则已经变了。 */
export class SettingsConflictError extends Error {
  constructor(message = 'settings changed since the draft was loaded') {
    super(message)
    this.name = 'SettingsConflictError'
  }
}

/** 保存在旧提示词版本之上：历史里已经有更新的版本。 */
export class PromptConflictError extends Error {
  constructor(message = 'prompt version changed since the draft was loaded') {
    super(message)
    this.name = 'PromptConflictError'
  }
}

export interface SettingsStoreOptions {
  /** 状态目录；两份文件都落在它下面。 */
  directory: string
  /** 启动配置给的初始并行工单数（首次运行、没有 settings.json 时使用）。 */
  defaultMaxWorkers: number
  /** 随包内置的提示词，作为版本 0 的基线。 */
  defaultPrompts: PromptTexts
  /** 降级事实（文件损坏、非法行）交给调用方记日志。 */
  onWarning?: (message: string) => void
}

export interface SettingsSnapshot {
  revision: number
  executor: ExecutorSettings
  rules: DispatchRule[]
}

interface StoredSettings {
  version: number
  revision: number
  executor: ExecutorSettings
  policy: { rules: DispatchRule[] }
}

export class SettingsStore {
  readonly #path: string
  readonly #historyPath: string
  readonly #defaults: PromptVersion
  #settings: StoredSettings
  /** 内存中的完整版本，按 revision 升序；内置默认不在其中。 */
  #history: PromptVersion[]
  #queue: Promise<void> = Promise.resolve()
  #closed = false

  private constructor(
    path: string,
    historyPath: string,
    settings: StoredSettings,
    history: PromptVersion[],
    defaults: PromptVersion,
  ) {
    this.#path = path
    this.#historyPath = historyPath
    this.#settings = settings
    this.#history = history
    this.#defaults = defaults
  }

  static async open(options: SettingsStoreOptions): Promise<SettingsStore> {
    const directory = await ensureDirectory(options.directory)
    const defaults = defaultVersion(options.defaultPrompts)
    const settings = await loadSettings(directory, options)
    const history = await loadHistory(directory, options)
    return new SettingsStore(
      join(directory, SETTINGS_FILE),
      join(directory, HISTORY_FILE),
      settings,
      history,
      defaults,
    )
  }

  snapshot(): SettingsSnapshot {
    return {
      revision: this.#settings.revision,
      executor: { ...this.#settings.executor },
      rules: this.#settings.policy.rules.map(rule => ({ ...rule })),
    }
  }

  promptTexts(): PromptTexts {
    return { ...this.promptSummaryVersion().texts }
  }

  promptSummary(): PromptVersionSummary {
    return summaryOf(this.promptSummaryVersion())
  }

  /** 已保存版本，新到旧；内置默认不在历史里（它是 `promptVersion(0)`）。 */
  promptHistory(limit = 50): PromptVersionSummary[] {
    if (limit <= 0) return []
    return this.#history.slice(-limit).reverse().map(summaryOf)
  }

  /** 版本 0 是内置默认；不存在的版本返回 undefined。 */
  promptVersion(revision: number): PromptVersion | undefined {
    if (revision === 0) return this.#defaults
    return this.#history.find(version => version.revision === revision)
  }

  async saveExecutor(executor: ExecutorSettings, baseRevision: number): Promise<number> {
    return this.#enqueue(async () => {
      this.#ensureOpen()
      if (baseRevision !== this.#settings.revision) throw new SettingsConflictError()
      const next: StoredSettings = {
        version: SETTINGS_FORMAT,
        revision: this.#settings.revision + 1,
        executor: { ...executor },
        policy: this.#settings.policy,
      }
      await this.#writeSettings(next)
      this.#settings = next
      return next.revision
    })
  }

  async savePolicy(rules: readonly DispatchRule[], baseRevision: number): Promise<number> {
    return this.#enqueue(async () => {
      this.#ensureOpen()
      if (baseRevision !== this.#settings.revision) throw new SettingsConflictError()
      const next: StoredSettings = {
        version: SETTINGS_FORMAT,
        revision: this.#settings.revision + 1,
        executor: this.#settings.executor,
        policy: { rules: rules.map(rule => ({ ...rule })) },
      }
      await this.#writeSettings(next)
      this.#settings = next
      return next.revision
    })
  }

  async savePrompts(texts: PromptTexts, baseRevision: number): Promise<PromptVersion> {
    return this.#enqueue(async () => {
      this.#ensureOpen()
      const current = this.promptSummaryVersion()
      if (baseRevision !== current.revision) throw new PromptConflictError()
      const version = makeVersion(current.revision + 1, texts)
      // 先落文件再改内存：追加失败时内存里不该出现一个磁盘上没有的版本。
      await appendFile(this.#historyPath, `${JSON.stringify(version)}\n`, 'utf8')
      this.#history.push(version)
      return version
    })
  }

  async close(): Promise<void> {
    this.#closed = true
    await this.#queue
  }

  promptSummaryVersion(): PromptVersion {
    return this.#history.at(-1) ?? this.#defaults
  }

  #ensureOpen(): void {
    if (this.#closed) throw new Error('settings store is closed; writes are rejected')
  }

  /** 串行化写入：并发保存不会互相覆盖临时文件或历史顺序。 */
  #enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const run = this.#queue.catch(() => undefined).then(operation)
    this.#queue = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }

  async #writeSettings(settings: StoredSettings): Promise<void> {
    const temporary = `${this.#path}.tmp`
    await writeFile(temporary, `${JSON.stringify(settings, null, 2)}\n`, 'utf8')
    await rename(temporary, this.#path)
  }
}

function defaultVersion(texts: PromptTexts): PromptVersion {
  return { revision: 0, savedAt: '', source: 'defaults', ...promptStats(texts), texts: { ...texts } }
}

function makeVersion(revision: number, texts: PromptTexts): PromptVersion {
  return {
    revision,
    savedAt: new Date().toISOString(),
    source: 'panel',
    ...promptStats(texts),
    texts: { ...texts },
  }
}

function summaryOf(version: PromptVersion): PromptVersionSummary {
  const { texts: _texts, ...summary } = version
  return summary
}

function defaultSettings(options: SettingsStoreOptions): StoredSettings {
  const maxWorkers = Math.min(
    MAX_WORKERS.max,
    Math.max(MAX_WORKERS.min, Math.trunc(options.defaultMaxWorkers)),
  )
  return {
    version: SETTINGS_FORMAT,
    revision: 0,
    executor: { maxWorkers, model: null, rootDirectory: null },
    policy: { rules: [] },
  }
}

async function loadSettings(
  directory: string,
  options: SettingsStoreOptions,
): Promise<StoredSettings> {
  const fallback = defaultSettings(options)
  let raw: string
  try {
    raw = await readFile(join(directory, SETTINGS_FILE), 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      options.onWarning?.(`settings.json is unreadable (${describe(error)}); settings start from defaults`)
    }
    return fallback
  }
  if (raw.trim().length === 0) return fallback

  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed) || parsed.version !== SETTINGS_FORMAT) {
      throw new Error('unsupported settings format')
    }
    if (typeof parsed.revision !== 'number' || !Number.isInteger(parsed.revision) || parsed.revision < 0) {
      throw new Error('invalid revision')
    }
    if (!isRecord(parsed.policy)) throw new Error('invalid policy')
    return {
      version: SETTINGS_FORMAT,
      revision: parsed.revision,
      executor: parseExecutorSettings(parsed.executor),
      policy: { rules: parseDispatchRules(parsed.policy.rules) },
    }
  } catch (error) {
    options.onWarning?.(`settings.json is unreadable (${describe(error)}); settings start from defaults`)
    return fallback
  }
}

async function loadHistory(
  directory: string,
  options: SettingsStoreOptions,
): Promise<PromptVersion[]> {
  let raw: string
  try {
    raw = await readFile(join(directory, HISTORY_FILE), 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      options.onWarning?.(
        `prompt-history.jsonl is unreadable (${describe(error)}); prompt versions start from defaults`,
      )
    }
    return []
  }

  const versions: PromptVersion[] = []
  const lines = raw.split('\n')
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]?.trim() ?? ''
    if (line.length === 0) continue
    const version = parseHistoryLine(line, options)
    if (version === undefined) continue
    // 只接受严格递增的版本号：重复或倒退的行来自手工编辑，不能覆盖已有事实。
    const previous = versions.at(-1)
    if (previous !== undefined && version.revision <= previous.revision) {
      options.onWarning?.(
        `prompt-history.jsonl line ${index + 1} has revision ${version.revision} after ${previous.revision}; ignored`,
      )
      continue
    }
    versions.push(version)
  }
  return versions
}

function parseHistoryLine(line: string, options: SettingsStoreOptions): PromptVersion | undefined {
  try {
    const parsed: unknown = JSON.parse(line)
    if (!isRecord(parsed)) throw new Error('entry is not an object')
    if (typeof parsed.revision !== 'number' || !Number.isInteger(parsed.revision) || parsed.revision <= 0) {
      throw new Error('invalid revision')
    }
    if (typeof parsed.savedAt !== 'string' || parsed.savedAt.length === 0) {
      throw new Error('invalid savedAt')
    }
    const texts = parsePromptTexts(parsed.texts)
    return { revision: parsed.revision, savedAt: parsed.savedAt, source: 'panel', ...promptStats(texts), texts }
  } catch (error) {
    options.onWarning?.(`prompt-history.jsonl entry is unreadable (${describe(error)}); ignored`)
    return undefined
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
