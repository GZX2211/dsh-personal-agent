// tests/host/settings/service.test.ts
//
// 设置服务把存储、校验、装配和模型目录接到一起：视图一次给全，保存按稳定
// 错误类别失败，提示词装配始终读当前设置。

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MAX_WORKERS, type ModelCatalogView, type PromptTexts } from '../../../src/shared/settings.ts'
import {
  PromptConflictError,
  PromptRevisionNotFoundError,
  SettingsConflictError,
  SettingsInputError,
} from '../../../src/host/settings/errors.ts'
import { createSettingsService, type SettingsService } from '../../../src/host/settings/service.ts'
import { SettingsStore } from '../../../src/host/settings/store.ts'

const DEFAULTS: PromptTexts = {
  shared: '默认共享约定',
  router: '默认路由角色',
  worker: '默认执行角色',
}

const CATALOG: ModelCatalogView = {
  default: { provider: 'deepseek-official', model: 'deepseek-flash', reasoningEffort: 'high' },
  providers: [
    {
      id: 'deepseek-official',
      name: 'DeepSeek',
      models: [
        { id: 'deepseek-flash', name: 'Flash', reasoning: { efforts: [{ id: 'high', name: 'High' }] } },
      ],
    },
  ],
  failures: [],
}

let directory: string
let store: SettingsStore
let service: SettingsService

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'pa-settings-service-'))
  store = await SettingsStore.open({
    directory,
    defaultMaxWorkers: MAX_WORKERS.defaultValue,
    defaultPrompts: DEFAULTS,
  })
  service = createSettingsService({
    store,
    stateDirectory: directory,
    modelCatalog: async () => CATALOG,
  })
})

afterEach(async () => {
  await store.close()
  await rm(directory, { recursive: true, force: true })
})

describe('settings view', () => {
  it('returns defaults, the current policy version and the model catalog', async () => {
    const view = await service.view()

    expect(view.revision).toBe(0)
    expect(view.executor).toEqual({ maxWorkers: 5, model: null, rootDirectory: null })
    expect(view.defaultRoot).toBe(join(directory, 'work'))
    expect(view.policy.version).toMatch(/^[0-9a-f]{8}$/)
    expect(view.policy.permissions).toEqual([])
    expect(view.policy.permissionVersion).toMatch(/^[0-9a-f]{8}$/)
    expect(view.prompts.current.revision).toBe(0)
    expect(view.prompts.current.source).toBe('defaults')
    expect(view.prompts.defaults).toEqual(DEFAULTS)
    expect(view.prompts.history).toEqual([])
    expect(view.models).toEqual(CATALOG)
  })
})

describe('executor saves', () => {
  it('validates, persists and returns the new revision with the current policy version', async () => {
    const saved = await service.saveExecutor({
      executor: { maxWorkers: 8, model: { provider: 'deepseek-official', model: 'deepseek-flash' }, rootDirectory: 'C:\\work' },
      revision: 0,
    })

    expect(saved).toEqual({
      ok: true,
      revision: 1,
      policyVersion: expect.stringMatching(/^[0-9a-f]{8}$/),
      permissionVersion: expect.stringMatching(/^[0-9a-f]{8}$/),
    })
    expect(service.maxWorkers()).toBe(8)
    expect(service.workerModel()).toEqual({ provider: 'deepseek-official', model: 'deepseek-flash' })
    expect(service.executorRoot()).toBe('C:\\work')
  })

  it('rejects an invalid body with a stable input error', async () => {
    await expect(service.saveExecutor(undefined)).rejects.toBeInstanceOf(SettingsInputError)
    await expect(service.saveExecutor({ revision: 0 })).rejects.toBeInstanceOf(SettingsInputError)
    await expect(
      service.saveExecutor({ executor: { maxWorkers: 0, model: null, rootDirectory: null }, revision: 0 }),
    ).rejects.toBeInstanceOf(SettingsInputError)
    await expect(
      service.saveExecutor({ executor: { maxWorkers: 5, model: null, rootDirectory: null }, revision: -1 }),
    ).rejects.toBeInstanceOf(SettingsInputError)
    await expect(
      service.saveExecutor({ executor: { maxWorkers: 5, model: null, rootDirectory: null }, revision: 1.5 }),
    ).rejects.toBeInstanceOf(SettingsInputError)
  })

  it('rejects a stale revision with a conflict', async () => {
    await service.saveExecutor({ executor: { maxWorkers: 6, model: null, rootDirectory: null }, revision: 0 })

    await expect(
      service.saveExecutor({ executor: { maxWorkers: 7, model: null, rootDirectory: null }, revision: 0 }),
    ).rejects.toBeInstanceOf(SettingsConflictError)
  })

  it('falls back to the default root when the directory is unset', async () => {
    expect(service.executorRoot()).toBe(join(directory, 'work'))
  })
})

describe('policy saves', () => {
  it('persists both rule sets and returns their new versions', async () => {
    const saved = await service.savePolicy({
      rules: [{ id: 'rule-a', name: '文案修正', instruction: '修正错别字', enabled: true }],
      permissions: [{ id: 'rule-b', name: '提交审批', instruction: '改动生产数据前问人', enabled: true }],
      revision: 0,
    })

    expect(saved).toMatchObject({
      ok: true,
      revision: 1,
      policyVersion: expect.stringMatching(/^[0-9a-f]{8}$/),
      permissionVersion: expect.stringMatching(/^[0-9a-f]{8}$/),
    })
    expect(service.rules()).toEqual([
      { id: 'rule-a', name: '文案修正', instruction: '修正错别字', enabled: true },
    ])
    expect(service.permissions()).toEqual([
      { id: 'rule-b', name: '提交审批', instruction: '改动生产数据前问人', enabled: true },
    ])
    expect(service.policyVersion()).not.toBe(service.permissionVersion())
  })

  it('rejects malformed rules and stale revisions', async () => {
    await expect(
      service.savePolicy({
        rules: [{ name: '', instruction: 'x', enabled: true }],
        permissions: [],
        revision: 0,
      }),
    ).rejects.toBeInstanceOf(SettingsInputError)
    await service.savePolicy({ rules: [], permissions: [], revision: 0 })
    await expect(service.savePolicy({ rules: [], permissions: [], revision: 0 })).rejects.toBeInstanceOf(
      SettingsConflictError,
    )
  })
})

describe('view after saves', () => {
  it('reflects the newest revision, policy versions and prompt history', async () => {
    await service.saveExecutor({ executor: { maxWorkers: 6, model: null, rootDirectory: null }, revision: 0 })
    await service.savePolicy({
      rules: [{ id: 'rule-a', name: '文案修正', instruction: '修正错别字', enabled: true }],
      permissions: [{ id: 'rule-b', name: '提交审批', instruction: '改动生产数据前问人', enabled: true }],
      revision: 1,
    })
    await service.savePrompts({ texts: { shared: '共享', router: '路由', worker: '执行' }, baseRevision: 0 })

    const view = await service.view()
    expect(view.revision).toBe(2)
    expect(view.policy.rules).toHaveLength(1)
    expect(view.policy.version).toBe(service.policyVersion())
    expect(view.policy.permissions).toHaveLength(1)
    expect(view.policy.permissionVersion).toBe(service.permissionVersion())
    expect(view.prompts.current.revision).toBe(1)
    expect(view.prompts.history.map(item => item.revision)).toEqual([1])
  })

  it('rejects a negative or fractional prompt revision', () => {
    expect(() => service.promptVersion(-1)).toThrow(PromptRevisionNotFoundError)
    expect(() => service.promptVersion(1.5)).toThrow(PromptRevisionNotFoundError)
  })

  it('drops a disabled rule from the router prompt', async () => {
    await service.savePolicy({
      rules: [{ id: 'rule-a', name: '文案修正', instruction: '修正错别字', enabled: true }],
      permissions: [],
      revision: 0,
    })
    expect(service.composePrompt('router')).toContain('## 派单规则')

    await service.savePolicy({
      rules: [{ id: 'rule-a', name: '文案修正', instruction: '修正错别字', enabled: false }],
      permissions: [],
      revision: 1,
    })
    expect(service.composePrompt('router')).not.toContain('## 派单规则')
  })

  it('keeps the executor root across a reopen', async () => {
    await service.saveExecutor({
      executor: { maxWorkers: 5, model: null, rootDirectory: '/srv/agent' },
      revision: 0,
    })
    await store.close()

    store = await SettingsStore.open({
      directory,
      defaultMaxWorkers: MAX_WORKERS.defaultValue,
      defaultPrompts: DEFAULTS,
    })
    const reopened = createSettingsService({
      store,
      stateDirectory: directory,
      modelCatalog: async () => CATALOG,
    })
    expect(reopened.executorRoot()).toBe('/srv/agent')
  })
})

describe('prompt saves and composition', () => {
  const next: PromptTexts = { shared: '新共享', router: '新路由', worker: '新执行' }

  it('saves a new version and reports its summary', async () => {
    const saved = await service.savePrompts({ texts: next, baseRevision: 0 })

    expect(saved).toMatchObject({
      ok: true,
      version: {
        revision: 1,
        source: 'panel',
        parts: 3,
        chars: next.shared.length + next.router.length + next.worker.length,
      },
    })
    expect(service.promptTexts()).toEqual(next)
  })

  it('rejects malformed texts and stale revisions', async () => {
    await expect(service.savePrompts({ texts: { shared: 'x' }, baseRevision: 0 })).rejects.toBeInstanceOf(
      SettingsInputError,
    )
    await service.savePrompts({ texts: next, baseRevision: 0 })
    await expect(service.savePrompts({ texts: next, baseRevision: 0 })).rejects.toBeInstanceOf(PromptConflictError)
  })

  it('reads the built-in default and saved versions by number', async () => {
    await service.savePrompts({ texts: next, baseRevision: 0 })

    expect(service.promptVersion(0)?.texts).toEqual(DEFAULTS)
    expect(service.promptVersion(1)?.texts).toEqual(next)
    expect(() => service.promptVersion(9)).toThrow(PromptRevisionNotFoundError)
  })

  it('composes each role prompt with its own rules and version', async () => {
    await service.savePolicy({
      rules: [
        { id: 'rule-a', name: '文案修正', instruction: '修正错别字', enabled: true },
        { id: 'rule-b', name: '视觉修正', instruction: '调整间距', enabled: false },
      ],
      permissions: [
        { id: 'rule-c', name: '提交审批', instruction: '改动生产数据前问人', enabled: true },
      ],
      revision: 0,
    })

    const router = service.composePrompt('router')
    expect(router).toContain(DEFAULTS.shared)
    expect(router).toContain(DEFAULTS.router)
    expect(router).toContain('## 派单规则')
    expect(router).toContain('文案修正：修正错别字')
    expect(router).not.toContain('视觉修正')
    expect(router).toContain(`策略版本 ${service.policyVersion()}`)
    expect(router).not.toContain('## 决策权限')

    const worker = service.composePrompt('worker')
    expect(worker).toContain(DEFAULTS.shared)
    expect(worker).toContain(DEFAULTS.worker)
    expect(worker).toContain('## 决策权限')
    expect(worker).toContain('提交审批：改动生产数据前问人')
    expect(worker).toContain(`权限版本 ${service.permissionVersion()}`)
    expect(worker).not.toContain('## 派单规则')
  })

  it('drops a disabled permission from the worker prompt', async () => {
    await service.savePolicy({
      rules: [],
      permissions: [{ id: 'rule-c', name: '提交审批', instruction: '改动生产数据前问人', enabled: true }],
      revision: 0,
    })
    expect(service.composePrompt('worker')).toContain('## 决策权限')

    await service.savePolicy({
      rules: [],
      permissions: [{ id: 'rule-c', name: '提交审批', instruction: '改动生产数据前问人', enabled: false }],
      revision: 1,
    })
    expect(service.composePrompt('worker')).not.toContain('## 决策权限')
  })

  it('reflects a saved prompt in the next composition', async () => {
    await service.savePrompts({ texts: next, baseRevision: 0 })

    expect(service.composePrompt('worker')).toBe('新共享\n\n新执行')
    expect(service.composePrompt('router')).toBe('新共享\n\n新路由')
  })
})
