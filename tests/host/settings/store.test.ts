// tests/host/settings/store.test.ts
//
// 设置存储：settings.json 保存执行器与规则，prompt-history.jsonl 只追加提示词版本。
// 两个文件各管一件事；revision 是乐观锁，保存旧基准必须被拒绝。

import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MAX_WORKERS, type PromptTexts } from '../../../src/shared/settings.ts'
import {
  PromptConflictError,
  SettingsConflictError,
  SettingsStore,
} from '../../../src/host/settings/store.ts'

const DEFAULTS: PromptTexts = {
  shared: '默认共享约定',
  router: '默认路由角色',
  worker: '默认执行角色',
}

let directory: string
let warnings: string[]

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'pa-settings-'))
  warnings = []
})

afterEach(async () => {
  await rm(directory, { recursive: true, force: true })
})

async function open(): Promise<SettingsStore> {
  return SettingsStore.open({
    directory,
    defaultMaxWorkers: MAX_WORKERS.defaultValue,
    defaultPrompts: DEFAULTS,
    onWarning: message => warnings.push(message),
  })
}

describe('SettingsStore defaults', () => {
  it('starts from the startup defaults before any file exists', async () => {
    const store = await open()

    expect(store.snapshot()).toEqual({
      revision: 0,
      executor: { maxWorkers: 5, model: null, rootDirectory: null },
      rules: [],
    })
    expect(store.promptTexts()).toEqual(DEFAULTS)
    expect(store.promptSummary()).toEqual({
      revision: 0,
      savedAt: '',
      source: 'defaults',
      parts: 3,
      chars: DEFAULTS.shared.length + DEFAULTS.router.length + DEFAULTS.worker.length,
    })
    expect(store.promptHistory()).toEqual([])
    await store.close()
  })

  it('returns the built-in defaults as revision zero', async () => {
    const store = await open()

    expect(store.promptVersion(0)).toEqual({
      revision: 0,
      savedAt: '',
      source: 'defaults',
      parts: 3,
      chars: DEFAULTS.shared.length + DEFAULTS.router.length + DEFAULTS.worker.length,
      texts: DEFAULTS,
    })
    expect(store.promptVersion(1)).toBeUndefined()
    await store.close()
  })

  it('uses the configured startup slot count as the initial value', async () => {
    const store = await SettingsStore.open({
      directory,
      defaultMaxWorkers: 3,
      defaultPrompts: DEFAULTS,
    })

    expect(store.snapshot().executor.maxWorkers).toBe(3)
    await store.close()
  })
})

describe('SettingsStore executor and policy saves', () => {
  it('bumps the revision and persists the executor settings', async () => {
    const store = await open()
    const revision = await store.saveExecutor(
      { maxWorkers: 8, model: { provider: 'deepseek-official', model: 'deepseek-flash', reasoningEffort: 'high' }, rootDirectory: 'C:\\work' },
      0,
    )
    await store.close()

    expect(revision).toBe(1)
    const reopened = await open()
    expect(reopened.snapshot()).toEqual({
      revision: 1,
      executor: {
        maxWorkers: 8,
        model: { provider: 'deepseek-official', model: 'deepseek-flash', reasoningEffort: 'high' },
        rootDirectory: 'C:\\work',
      },
      rules: [],
    })
    await expect(readFile(join(directory, 'settings.json'), 'utf8')).resolves.toContain('"maxWorkers": 8')
    await reopened.close()
  })

  it('rejects a save based on a stale revision', async () => {
    const store = await open()
    await store.saveExecutor({ maxWorkers: 7, model: null, rootDirectory: null }, 0)

    await expect(store.saveExecutor({ maxWorkers: 6, model: null, rootDirectory: null }, 0)).rejects.toBeInstanceOf(
      SettingsConflictError,
    )
    await expect(store.savePolicy([], 0)).rejects.toBeInstanceOf(SettingsConflictError)
    await store.close()
  })

  it('persists rules and shares the settings revision with the executor', async () => {
    const store = await open()
    const rules = [{ id: 'rule-a', name: '文案修正', instruction: '修正错别字', enabled: true }]
    const revision = await store.savePolicy(rules, 0)
    const executorRevision = await store.saveExecutor({ maxWorkers: 4, model: null, rootDirectory: null }, revision)
    await store.close()

    expect(revision).toBe(1)
    expect(executorRevision).toBe(2)
    const reopened = await open()
    expect(reopened.snapshot().rules).toEqual(rules)
    expect(reopened.snapshot().revision).toBe(2)
    await reopened.close()
  })
})

describe('SettingsStore prompt versions', () => {
  const next: PromptTexts = { shared: '新共享', router: '新路由', worker: '新执行' }

  it('appends an immutable version and exposes it by number', async () => {
    const store = await open()
    const version = await store.savePrompts(next, 0)

    expect(version).toMatchObject({
      revision: 1,
      source: 'panel',
      parts: 3,
      chars: next.shared.length + next.router.length + next.worker.length,
      texts: next,
    })
    expect(version.savedAt).not.toBe('')
    expect(store.promptTexts()).toEqual(next)
    expect(store.promptVersion(1)?.texts).toEqual(next)
    expect(store.promptHistory()).toHaveLength(1)
    await store.close()
  })

  it('keeps every version and lists the newest first', async () => {
    const store = await open()
    await store.savePrompts(next, 0)
    const second = { shared: '第二版共享', router: '第二版路由', worker: '第二版执行' }
    await store.savePrompts(second, 1)
    await store.close()

    const reopened = await open()
    expect(reopened.promptHistory().map(item => item.revision)).toEqual([2, 1])
    expect(reopened.promptVersion(1)?.texts).toEqual(next)
    expect(reopened.promptVersion(2)?.texts).toEqual(second)
    expect(reopened.promptSummary().revision).toBe(2)
    await reopened.close()
  })

  it('records a new version even when the text is identical', async () => {
    const store = await open()
    await store.savePrompts(next, 0)
    await store.savePrompts(next, 1)

    expect(store.promptVersion(1)?.texts).toEqual(next)
    expect(store.promptVersion(2)?.texts).toEqual(next)
    expect(store.promptHistory().map(item => item.revision)).toEqual([2, 1])
    await store.close()
  })

  it('rejects a save based on a stale prompt revision', async () => {
    const store = await open()
    await store.savePrompts(next, 0)

    await expect(store.savePrompts(DEFAULTS, 0)).rejects.toBeInstanceOf(PromptConflictError)
    await store.close()
  })

  it('limits the history list to the requested length while keeping every version stored', async () => {
    const store = await open()
    for (let revision = 1; revision <= 3; revision += 1) {
      await store.savePrompts({ ...next, shared: `第 ${revision} 版` }, revision - 1)
    }

    expect(store.promptHistory(2).map(item => item.revision)).toEqual([3, 2])
    expect(store.promptVersion(1)?.texts.shared).toBe('第 1 版')
    await store.close()
  })
})

describe('SettingsStore concurrency and edges', () => {
  it('serializes concurrent executor saves so only one wins the same base revision', async () => {
    const store = await open()
    const results = await Promise.allSettled([
      store.saveExecutor({ maxWorkers: 6, model: null, rootDirectory: null }, 0),
      store.saveExecutor({ maxWorkers: 7, model: null, rootDirectory: null }, 0),
    ])

    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(1)
    expect(store.snapshot().revision).toBe(1)
    await store.close()
  })

  it('reads a history file whose last line has no trailing newline', async () => {
    const line = JSON.stringify({ revision: 1, savedAt: '2026-01-01T00:00:00.000Z', source: 'panel', texts: DEFAULTS })
    await writeFile(join(directory, 'prompt-history.jsonl'), line, 'utf8')

    const store = await open()

    expect(store.promptVersion(1)?.texts).toEqual(DEFAULTS)
    await store.close()
  })

  it('returns no history entries for a non-positive limit', async () => {
    const store = await open()
    await store.savePrompts(DEFAULTS, 0)

    expect(store.promptHistory(0)).toEqual([])
    expect(store.promptHistory(-1)).toEqual([])
    await store.close()
  })

  it('updates the summary statistics after a prompt save', async () => {
    const store = await open()
    const texts = { shared: '第一段\n\n第二段', router: '路由', worker: '执行' }
    await store.savePrompts(texts, 0)

    expect(store.promptSummary()).toMatchObject({ revision: 1, parts: 4, chars: texts.shared.length + texts.router.length + texts.worker.length })
    await store.close()
  })
})

describe('SettingsStore degradation', () => {
  it('falls back to defaults and warns when settings.json is unreadable', async () => {
    await writeFile(join(directory, 'settings.json'), '{not json', 'utf8')
    const store = await open()

    expect(store.snapshot().revision).toBe(0)
    expect(store.snapshot().executor.maxWorkers).toBe(5)
    expect(warnings.some(message => message.includes('settings.json'))).toBe(true)
    await store.close()
  })

  it('falls back to defaults when the stored executor is invalid', async () => {
    await writeFile(
      join(directory, 'settings.json'),
      JSON.stringify({ version: 1, revision: 4, executor: { maxWorkers: 0 }, policy: { rules: [] } }),
      'utf8',
    )
    const store = await open()

    expect(store.snapshot().revision).toBe(0)
    expect(warnings.some(message => message.includes('settings.json'))).toBe(true)
    await store.close()
  })

  it('skips broken prompt history lines and keeps the valid versions', async () => {
    const good = JSON.stringify({ revision: 1, savedAt: '2026-01-01T00:00:00.000Z', source: 'panel', texts: DEFAULTS })
    await writeFile(
      join(directory, 'prompt-history.jsonl'),
      ['{broken', good, JSON.stringify({ revision: 2, savedAt: '2026-01-02T00:00:00.000Z', texts: { shared: '' } })].join('\n'),
      'utf8',
    )
    const store = await open()

    expect(store.promptHistory().map(item => item.revision)).toEqual([1])
    expect(store.promptTexts()).toEqual(DEFAULTS)
    expect(warnings.some(message => message.includes('prompt-history'))).toBe(true)
    await store.close()
  })

  it('ignores a repeated or out-of-order revision in the history file', async () => {
    const line = (revision: number, shared: string) =>
      JSON.stringify({ revision, savedAt: `2026-01-0${revision}T00:00:00.000Z`, source: 'panel', texts: { ...DEFAULTS, shared } })
    await writeFile(
      join(directory, 'prompt-history.jsonl'),
      [line(1, '一'), line(1, '重复'), line(2, '二')].join('\n'),
      'utf8',
    )
    const store = await open()

    expect(store.promptHistory().map(item => item.revision)).toEqual([2, 1])
    expect(store.promptVersion(1)?.texts.shared).toBe('一')
    await store.close()
  })

  it('rejects writes after close', async () => {
    const store = await open()
    await store.close()

    await expect(store.saveExecutor({ maxWorkers: 5, model: null, rootDirectory: null }, 0)).rejects.toThrow(
      /closed/,
    )
    await expect(store.savePrompts(DEFAULTS, 0)).rejects.toThrow(/closed/)
  })
})
