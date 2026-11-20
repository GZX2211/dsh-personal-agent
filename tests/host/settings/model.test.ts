// tests/host/settings/model.test.ts
//
// 模型目录只做投影：服务商的目录失败互不影响，单模型的推理元数据失败只降级
// 那一项；宿主没有 LLM 服务时给一个可展示的失败，而不是让设置页整体报错。

import { describe, expect, it } from 'vitest'
import { readModelCatalog, type ModelCatalogSources } from '../../../src/host/settings/model.ts'

function sources(overrides: Partial<ModelCatalogSources> = {}): ModelCatalogSources {
  return {
    listProviders: () => [
      { id: 'deepseek-official', name: 'DeepSeek' },
      { id: 'broken', name: 'Broken' },
    ],
    listModels: async provider => {
      if (provider === 'broken') throw new Error('catalog unavailable')
      return [
        { id: 'deepseek-flash', name: 'Flash' },
        { id: 'deepseek-pro', name: 'Pro' },
      ]
    },
    resolveReasoning: async (_provider, model) =>
      model === 'deepseek-flash'
        ? { efforts: [{ id: 'low', name: 'Low' }, { id: 'high', name: 'High' }], defaultEffort: 'high' }
        : undefined,
    defaultSelection: () => ({ provider: 'deepseek-official', model: 'deepseek-flash', reasoningEffort: 'high' }),
    ...overrides,
  }
}

describe('readModelCatalog', () => {
  it('projects providers, models and reasoning efforts', async () => {
    const catalog = await readModelCatalog(sources())

    expect(catalog.default).toEqual({
      provider: 'deepseek-official',
      model: 'deepseek-flash',
      reasoningEffort: 'high',
    })
    expect(catalog.providers).toEqual([
      {
        id: 'deepseek-official',
        name: 'DeepSeek',
        models: [
          {
            id: 'deepseek-flash',
            name: 'Flash',
            reasoning: {
              efforts: [{ id: 'low', name: 'Low' }, { id: 'high', name: 'High' }],
              defaultEffort: 'high',
            },
          },
          { id: 'deepseek-pro', name: 'Pro' },
        ],
      },
    ])
    expect(catalog.failures).toEqual([{ id: 'broken', name: 'Broken', message: 'catalog unavailable' }])
  })

  it('keeps a model when only its reasoning lookup fails', async () => {
    const catalog = await readModelCatalog(
      sources({
        resolveReasoning: async () => {
          throw new Error('metadata unavailable')
        },
      }),
    )

    expect(catalog.providers[0]?.models).toEqual([
      { id: 'deepseek-flash', name: 'Flash' },
      { id: 'deepseek-pro', name: 'Pro' },
    ])
  })

  it('reports a missing LLM service instead of throwing', async () => {
    const catalog = await readModelCatalog(undefined)

    expect(catalog.providers).toEqual([])
    expect(catalog.default).toBeNull()
    expect(catalog.failures).toEqual([{ id: 'llm', name: 'LLM', message: '模型服务不可用' }])
  })

  it('ignores an empty default selection', async () => {
    const catalog = await readModelCatalog(sources({ defaultSelection: () => ({ provider: '', model: '' }) }))

    expect(catalog.default).toBeNull()
  })

  it('omits the default when the host reports none', async () => {
    const catalog = await readModelCatalog(sources({ defaultSelection: () => undefined }))

    expect(catalog.default).toBeNull()
  })
})
