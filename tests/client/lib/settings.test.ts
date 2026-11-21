// tests/client/lib/settings.test.ts
//
// 设置页的纯逻辑：行级 diff、规则与执行器草稿的校验、模型候选推导。
// 组件只负责把这些结果画出来；这里不依赖 React。

import { describe, expect, it } from 'vitest'
import type { ModelCatalogView, PromptTexts, WorkerModel } from '../../../src/shared/settings.ts'
import {
  diffLines,
  executorDraftError,
  executorDraftValue,
  isSameExecutor,
  isSamePromptTexts,
  isSameRules,
  modelAvailable,
  newRuleId,
  promptFullText,
  reasoningOptions,
  ruleDraftError,
} from '../../../src/client/lib/settings.ts'

const texts: PromptTexts = {
  shared: '共享第一段\n\n共享第二段',
  router: '路由角色',
  worker: '执行角色',
}

function catalog(): ModelCatalogView {
  return {
    default: { provider: 'deepseek-official', model: 'deepseek-flash', reasoningEffort: 'high' },
    providers: [
      {
        id: 'deepseek-official',
        name: 'DeepSeek',
        models: [
          {
            id: 'deepseek-flash',
            name: 'Flash',
            reasoning: { efforts: [{ id: 'low', name: 'Low' }, { id: 'high', name: 'High' }], defaultEffort: 'high' },
          },
          { id: 'deepseek-pro', name: 'Pro' },
        ],
      },
    ],
    failures: [],
  }
}

describe('diffLines', () => {
  it('reports no changes for identical text', () => {
    expect(diffLines('a\nb', 'a\nb')).toEqual([
      { kind: 'same', text: 'a' },
      { kind: 'same', text: 'b' },
    ])
  })

  it('marks an inserted line', () => {
    expect(diffLines('a\nc', 'a\nb\nc')).toEqual([
      { kind: 'same', text: 'a' },
      { kind: 'ins', text: 'b' },
      { kind: 'same', text: 'c' },
    ])
  })

  it('marks a removed line', () => {
    expect(diffLines('a\nb\nc', 'a\nc')).toEqual([
      { kind: 'same', text: 'a' },
      { kind: 'del', text: 'b' },
      { kind: 'same', text: 'c' },
    ])
  })

  it('marks a replaced line as a removal followed by an insertion', () => {
    expect(diffLines('a\nold\nc', 'a\nnew\nc')).toEqual([
      { kind: 'same', text: 'a' },
      { kind: 'del', text: 'old' },
      { kind: 'ins', text: 'new' },
      { kind: 'same', text: 'c' },
    ])
  })

  it('folds long unchanged runs while keeping context around the change', () => {
    const unchanged = Array.from({ length: 20 }, (_, index) => `line-${index}`)
    const base = [...unchanged, 'old'].join('\n')
    const next = [...unchanged, 'new'].join('\n')

    const lines = diffLines(base, next, 2)
    const fold = lines.find(line => line.kind === 'fold')

    expect(fold).toEqual({ kind: 'fold', count: 20 - 4 })
    expect(lines.slice(-2)).toEqual([
      { kind: 'del', text: 'old' },
      { kind: 'ins', text: 'new' },
    ])
  })

  it('does not fold short unchanged runs', () => {
    expect(diffLines('a\nb\nc', 'a\nb\nc', 2).some(line => line.kind === 'fold')).toBe(false)
  })

  it('falls back to a whole replacement instead of allocating a huge matrix', () => {
    const base = Array.from({ length: 700 }, (_, index) => `old-${index}`).join('\n')
    const next = Array.from({ length: 700 }, (_, index) => `new-${index}`).join('\n')

    const lines = diffLines(base, next)

    expect(lines.filter(line => line.kind === 'del')).toHaveLength(700)
    expect(lines.filter(line => line.kind === 'ins')).toHaveLength(700)
  })

  it('handles an empty side', () => {
    expect(diffLines('', 'a')).toEqual([{ kind: 'ins', text: 'a' }])
    expect(diffLines('a', '')).toEqual([{ kind: 'del', text: 'a' }])
  })
})

describe('newRuleId', () => {
  it('produces a contract-valid id that no existing rule uses', () => {
    const id = newRuleId([], 1_700_000_000_000)

    expect(id).toMatch(/^[a-z0-9][a-z0-9-]{0,39}$/)
    expect(newRuleId([{ id, name: 'a', instruction: 'b', enabled: true }], 1_700_000_000_000)).not.toBe(id)
  })

  it('is stable for the same clock and skips collisions', () => {
    const now = 1_700_000_000_000
    const first = newRuleId([], now)
    const second = newRuleId([{ id: first, name: 'a', instruction: 'b', enabled: true }], now)

    expect(first).not.toBe(second)
    expect(newRuleId([{ id: second, name: 'a', instruction: 'b', enabled: true }], now)).not.toBe(second)
  })
})

describe('ruleDraftError', () => {
  const valid = { id: 'rule-a', name: '文案修正', instruction: '修正错别字', enabled: true }

  it('accepts a complete rule', () => {
    expect(ruleDraftError(valid, [valid])).toBeUndefined()
  })

  it('rejects a blank or overlong name', () => {
    expect(ruleDraftError({ ...valid, name: '  ' }, [valid])).toBe('nameRequired')
    expect(ruleDraftError({ ...valid, name: 'x'.repeat(41) }, [valid])).toBe('nameTooLong')
  })

  it('rejects a blank or overlong instruction', () => {
    expect(ruleDraftError({ ...valid, instruction: ' ' }, [valid])).toBe('instructionRequired')
    expect(ruleDraftError({ ...valid, instruction: 'x'.repeat(501) }, [valid])).toBe('instructionTooLong')
  })

  it('rejects two rules with the same id', () => {
    expect(ruleDraftError(valid, [valid, { ...valid, name: '另一条' }])).toBe('duplicateId')
  })
})

describe('executorDraft', () => {
  it('accepts a valid slot count and an empty root', () => {
    expect(executorDraftError({ maxWorkers: '5', model: null, rootDirectory: '' })).toBeUndefined()
    expect(executorDraftValue({ maxWorkers: '5', model: null, rootDirectory: '  ' })).toEqual({
      maxWorkers: 5,
      model: null,
      rootDirectory: null,
    })
  })

  it('rejects a fractional, out-of-range or non-numeric slot count', () => {
    for (const maxWorkers of ['', '0', '101', '1.5', 'abc']) {
      expect(executorDraftError({ maxWorkers, model: null, rootDirectory: '' }), maxWorkers).toBe(
        'maxWorkersInvalid',
      )
    }
  })

  it('rejects an incomplete model selection', () => {
    expect(
      executorDraftError({ maxWorkers: '5', model: { provider: 'p', model: '' }, rootDirectory: '' }),
    ).toBe('modelIncomplete')
    expect(
      executorDraftError({ maxWorkers: '5', model: { provider: '', model: 'm' }, rootDirectory: '' }),
    ).toBe('modelIncomplete')
  })

  it('rejects a relative root and accepts an absolute one', () => {
    expect(executorDraftError({ maxWorkers: '5', model: null, rootDirectory: 'work' })).toBe(
      'rootNotAbsolute',
    )
    expect(executorDraftError({ maxWorkers: '5', model: null, rootDirectory: 'C:\\work' })).toBeUndefined()
    expect(executorDraftValue({ maxWorkers: '5', model: null, rootDirectory: 'C:\\work' }).rootDirectory).toBe(
      'C:\\work',
    )
  })
})

describe('contract edges', () => {
  it('keeps a trailing empty line as a diffable line', () => {
    expect(diffLines('a\n', 'a\n')).toEqual([
      { kind: 'same', text: 'a' },
      { kind: 'same', text: '' },
    ])
  })

  it('folds without context when the caller asks for none', () => {
    expect(diffLines('a\nb\nc\nd', 'a\nB\nc\nd', 0)).toEqual([
      { kind: 'same', text: 'a' },
      { kind: 'del', text: 'b' },
      { kind: 'ins', text: 'B' },
      { kind: 'fold', count: 2 },
    ])
  })

  it('accepts rule names and instructions exactly at their limits', () => {
    const rule = {
      id: 'rule-a',
      name: 'x'.repeat(40),
      instruction: 'y'.repeat(500),
      enabled: true,
    }

    expect(ruleDraftError(rule, [rule])).toBeUndefined()
  })

  it('normalizes the root while keeping the slot count numeric', () => {
    expect(
      executorDraftValue({ maxWorkers: '05', model: null, rootDirectory: '  /srv/agent  ' }),
    ).toEqual({ maxWorkers: 5, model: null, rootDirectory: '/srv/agent' })
  })
})

describe('model helpers', () => {
  it('lists reasoning efforts for a known model', () => {
    expect(reasoningOptions(catalog(), { provider: 'deepseek-official', model: 'deepseek-flash' })).toEqual([
      { id: 'low', name: 'Low' },
      { id: 'high', name: 'High' },
    ])
  })

  it('returns no efforts for an unknown model or one without reasoning', () => {
    expect(reasoningOptions(catalog(), { provider: 'ghost', model: 'x' })).toEqual([])
    expect(reasoningOptions(catalog(), { provider: 'deepseek-official', model: 'deepseek-pro' })).toEqual([])
    expect(reasoningOptions(catalog(), null)).toEqual([])
  })

  it('reports whether a saved selection is still in the catalog', () => {
    const model: WorkerModel = { provider: 'deepseek-official', model: 'deepseek-flash' }
    expect(modelAvailable(catalog(), model)).toBe(true)
    expect(modelAvailable(catalog(), { provider: 'deepseek-official', model: 'gone' })).toBe(false)
    expect(modelAvailable(catalog(), { provider: 'gone', model: 'deepseek-flash' })).toBe(false)
    expect(modelAvailable(catalog(), null)).toBe(true)
  })
})

describe('prompt helpers', () => {
  it('composes the full prompt for a role, including its own rule section', () => {
    const dispatchRules = [{ id: 'rule-a', name: '文案修正', instruction: '修正错别字', enabled: true }]
    const permissions = [{ id: 'rule-b', name: '提交审批', instruction: '改动生产数据前问人', enabled: true }]

    expect(
      promptFullText(texts, 'worker', {
        dispatchRules,
        permissions,
        policyVersion: 'ff00aa11',
      }),
    ).toContain('## 决策权限')
    expect(
      promptFullText(texts, 'router', {
        dispatchRules,
        permissions,
        policyVersion: 'ff00aa11',
      }),
    ).toContain('## 派单规则')
  })

  it('compares two prompt drafts by content', () => {
    expect(isSamePromptTexts(texts, { ...texts })).toBe(true)
    expect(isSamePromptTexts(texts, { ...texts, router: '改了' })).toBe(false)
  })

  it('compares two rule drafts by content', () => {
    const rules = [{ id: 'rule-a', name: '文案修正', instruction: '修正错别字', enabled: true }]

    expect(isSameRules(rules, [{ ...rules[0]! }])).toBe(true)
    expect(isSameRules(rules, [{ ...rules[0]!, enabled: false }])).toBe(false)
    expect(isSameRules(rules, [])).toBe(false)
  })
})

describe('isSameExecutor', () => {
  it('compares every field including an absent model', () => {
    const base = { maxWorkers: 5, model: null, rootDirectory: null }
    expect(isSameExecutor(base, { ...base })).toBe(true)
    expect(isSameExecutor(base, { ...base, maxWorkers: 6 })).toBe(false)
    expect(isSameExecutor(base, { ...base, model: { provider: 'p', model: 'm' } })).toBe(false)
    expect(
      isSameExecutor(
        { ...base, model: { provider: 'p', model: 'm', reasoningEffort: 'high' } },
        { ...base, model: { provider: 'p', model: 'm' } },
      ),
    ).toBe(false)
    expect(
      isSameExecutor({ ...base, rootDirectory: 'C:\\work' }, { ...base, rootDirectory: 'C:\\work' }),
    ).toBe(true)
  })
})
