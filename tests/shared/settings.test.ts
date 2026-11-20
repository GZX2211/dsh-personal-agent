// tests/shared/settings.test.ts
//
// 设置契约里的纯逻辑：规则/提示词/执行器输入的收窄、提示词装配与统计、模型格式化。
// Host 与 Client 共用这些函数，所以它们的行为必须与平台无关。

import { describe, expect, it } from 'vitest'
import {
  MAX_WORKERS,
  PROMPT_LIMITS,
  activeRules,
  composeDispatchSection,
  composePermissionSection,
  composeRolePrompt,
  countParagraphs,
  formatWorkerModel,
  isAbsoluteDirectory,
  parseDispatchRules,
  parseExecutorSettings,
  parsePromptTexts,
  promptStats,
  ruleIdOf,
  type DispatchRule,
  type PromptTexts,
} from '../../src/shared/settings.ts'

const texts: PromptTexts = {
  shared: '共享约定第一段\n\n共享约定第二段',
  router: '路由角色说明',
  worker: '执行角色说明',
}

function rule(overrides: Partial<DispatchRule> = {}): DispatchRule {
  return {
    id: 'rule-copy',
    name: '文案修正',
    instruction: '修正明确的错别字或标点错误。',
    enabled: true,
    ...overrides,
  }
}

describe('countParagraphs', () => {
  it('counts nothing for empty or blank text', () => {
    expect(countParagraphs('')).toBe(0)
    expect(countParagraphs('  \n\t\n ')).toBe(0)
  })

  it('counts one paragraph for a single block', () => {
    expect(countParagraphs('一行\n两行')).toBe(1)
  })

  it('treats blank lines as separators and ignores whitespace-only lines', () => {
    expect(countParagraphs('第一段\n\n第二段\n \n第三段')).toBe(3)
  })

  it('normalizes CRLF before splitting', () => {
    expect(countParagraphs('第一段\r\n\r\n第二段')).toBe(2)
  })
})

describe('promptStats', () => {
  it('sums the paragraphs and characters of all three parts', () => {
    const stats = promptStats(texts)

    expect(stats.parts).toBe(4)
    expect(stats.chars).toBe(texts.shared.length + texts.router.length + texts.worker.length)
  })

  it('reports zero for blank texts', () => {
    expect(promptStats({ shared: '', router: '', worker: '' })).toEqual({ parts: 0, chars: 0 })
  })
})

describe('activeRules', () => {
  it('keeps only enabled rules in order', () => {
    const rules = [rule({ id: 'a', enabled: false }), rule({ id: 'b' }), rule({ id: 'c', enabled: true })]

    expect(activeRules(rules).map(item => item.id)).toEqual(['b', 'c'])
  })
})

describe('ruleIdOf', () => {
  it('derives a stable, readable id from the rule content', () => {
    const first = ruleIdOf('文案修正', '修正错别字')
    const second = ruleIdOf('文案修正', '修正错别字')

    expect(first).toBe(second)
    expect(first).toMatch(/^rule-[0-9a-f]{8}$/)
  })

  it('separates different names or instructions', () => {
    expect(ruleIdOf('文案修正', '修正错别字')).not.toBe(ruleIdOf('文案修正', '修正标点'))
    expect(ruleIdOf('文案修正', '修正错别字')).not.toBe(ruleIdOf('视觉修正', '修正错别字'))
  })
})

describe('parseDispatchRules', () => {
  it('accepts a valid list and normalizes whitespace', () => {
    const parsed = parseDispatchRules([
      { id: 'copy', name: '  文案修正 ', instruction: ' 修正错别字 ', enabled: true },
      { id: 'visual', name: '视觉修正', instruction: '调整间距', enabled: false },
    ])

    expect(parsed).toEqual([
      { id: 'copy', name: '文案修正', instruction: '修正错别字', enabled: true },
      { id: 'visual', name: '视觉修正', instruction: '调整间距', enabled: false },
    ])
  })

  it('generates an id when the incoming one is missing or malformed', () => {
    const parsed = parseDispatchRules([
      { name: '文案修正', instruction: '修正错别字', enabled: true },
      { id: 'Has Space', name: '视觉修正', instruction: '调整间距', enabled: true },
    ])

    expect(parsed[0]?.id).toBe(ruleIdOf('文案修正', '修正错别字'))
    expect(parsed[1]?.id).toBe(ruleIdOf('视觉修正', '调整间距'))
  })

  it('rejects a missing or non-array value', () => {
    expect(() => parseDispatchRules(undefined)).toThrow(/规则列表/)
    expect(() => parseDispatchRules({})).toThrow(/规则列表/)
  })

  it('rejects more rules than the contract allows', () => {
    const rules = Array.from({ length: PROMPT_LIMITS.rules + 1 }, (_, index) =>
      rule({ id: `rule-${index}`, name: `规则 ${index}`, instruction: '说明' }),
    )

    expect(() => parseDispatchRules(rules)).toThrow(/最多/)
  })

  it('rejects blank, overlong names and instructions', () => {
    expect(() => parseDispatchRules([rule({ name: '   ' })])).toThrow(/名称/)
    expect(() => parseDispatchRules([rule({ name: 'x'.repeat(PROMPT_LIMITS.ruleName + 1) })])).toThrow(/名称/)
    expect(() => parseDispatchRules([rule({ instruction: ' ' })])).toThrow(/说明/)
    expect(() => parseDispatchRules([rule({ instruction: 'x'.repeat(PROMPT_LIMITS.ruleInstruction + 1) })])).toThrow(
      /说明/,
    )
  })

  it('rejects a non-boolean enabled flag', () => {
    expect(() => parseDispatchRules([{ ...rule(), enabled: 'yes' }])).toThrow(/开关/)
  })

  it('rejects duplicate ids so a rule cannot be toggled twice by one control', () => {
    expect(() => parseDispatchRules([rule({ id: 'same' }), rule({ id: 'same' })])).toThrow(/重复/)
  })
})

describe('composeDispatchSection', () => {
  it('renders nothing without an enabled rule', () => {
    expect(composeDispatchSection([])).toBe('')
    expect(composeDispatchSection([rule({ enabled: false })])).toBe('')
  })

  it('lists each enabled rule on one line with its name and instruction', () => {
    const section = composeDispatchSection([rule()])

    expect(section).toContain('## 派单规则')
    expect(section).toContain('文案修正：修正明确的错别字或标点错误。')
  })

  it('flattens multi-line instructions so one rule cannot forge a heading', () => {
    const section = composeDispatchSection([rule({ instruction: '第一行\n第二行\n\n第三行' })])

    expect(section).toContain('文案修正：第一行 第二行 第三行')
    expect(section).not.toContain('\n第三行')
  })

  it('names the policy version when one is supplied', () => {
    expect(composeDispatchSection([rule()], 'e28e2ee0')).toContain('策略版本 e28e2ee0')
    expect(composeDispatchSection([rule()])).not.toContain('策略版本')
  })
})

describe('composePermissionSection', () => {
  it('renders nothing without an enabled permission', () => {
    expect(composePermissionSection([])).toBe('')
    expect(composePermissionSection([rule({ enabled: false })])).toBe('')
  })

  it('uses its own heading and version label', () => {
    const section = composePermissionSection([rule({ name: '提交审批', instruction: '改动生产数据前必须问人' })], 'ff00aa11')

    expect(section).toContain('## 决策权限')
    expect(section).toContain('权限版本 ff00aa11')
    expect(section).toContain('提交审批：改动生产数据前必须问人')
    expect(section).not.toContain('## 派单规则')
  })
})

describe('composeRolePrompt', () => {
  it('joins the shared part and the role part with one blank line', () => {
    expect(composeRolePrompt(texts, 'worker')).toBe(`${texts.shared}\n\n${texts.worker}`)
  })

  it('appends the dispatch section to the router only', () => {
    const dispatchRules = [rule()]

    expect(
      composeRolePrompt(texts, 'router', { dispatchRules, dispatchVersion: 'abcd1234' }),
    ).toContain('## 派单规则')
    expect(
      composeRolePrompt(texts, 'worker', { dispatchRules, dispatchVersion: 'abcd1234' }),
    ).not.toContain('## 派单规则')
  })

  it('appends the permission section to the worker only', () => {
    const permissions = [rule({ name: '提交审批', instruction: '改动生产数据前必须问人' })]

    expect(
      composeRolePrompt(texts, 'worker', { permissions, permissionVersion: 'ff00aa11' }),
    ).toContain('## 决策权限')
    expect(
      composeRolePrompt(texts, 'router', { permissions, permissionVersion: 'ff00aa11' }),
    ).not.toContain('## 决策权限')
  })

  it('does not append a section when every rule is off', () => {
    expect(
      composeRolePrompt(texts, 'router', {
        dispatchRules: [rule({ enabled: false })],
        dispatchVersion: 'abcd1234',
      }),
    ).toBe(`${texts.shared}\n\n${texts.router}`)
    expect(
      composeRolePrompt(texts, 'worker', {
        permissions: [rule({ enabled: false })],
        permissionVersion: 'ff00aa11',
      }),
    ).toBe(`${texts.shared}\n\n${texts.worker}`)
  })
})

describe('parsePromptTexts', () => {
  it('trims the edges and keeps interior line breaks', () => {
    const parsed = parsePromptTexts({
      shared: '  第一行\n第二行  ',
      router: '路由',
      worker: '执行',
    })

    expect(parsed).toEqual({ shared: '第一行\n第二行', router: '路由', worker: '执行' })
  })

  it('rejects a missing part or a non-string part', () => {
    expect(() => parsePromptTexts({ router: '路由', worker: '执行' })).toThrow(/shared/)
    expect(() => parsePromptTexts({ shared: 1, router: '路由', worker: '执行' })).toThrow(/shared/)
  })

  it('rejects a blank part', () => {
    expect(() => parsePromptTexts({ shared: '共享', router: '   ', worker: '执行' })).toThrow(/router/)
  })

  it('rejects a part beyond the character budget', () => {
    expect(() =>
      parsePromptTexts({
        shared: 'x'.repeat(PROMPT_LIMITS.promptPart + 1),
        router: '路由',
        worker: '执行',
      }),
    ).toThrow(/字符/)
  })
})

describe('isAbsoluteDirectory', () => {
  it('accepts Windows drive, UNC and POSIX absolute paths', () => {
    expect(isAbsoluteDirectory('C:\\work\\agent')).toBe(true)
    expect(isAbsoluteDirectory('D:/work/agent')).toBe(true)
    expect(isAbsoluteDirectory('\\\\server\\share')).toBe(true)
    expect(isAbsoluteDirectory('/srv/agent')).toBe(true)
  })

  it('rejects relative and empty paths', () => {
    expect(isAbsoluteDirectory('work/agent')).toBe(false)
    expect(isAbsoluteDirectory('./work')).toBe(false)
    expect(isAbsoluteDirectory('C:work')).toBe(false)
    expect(isAbsoluteDirectory('')).toBe(false)
  })
})

describe('parseExecutorSettings', () => {
  it('accepts the boundaries of the worker-slot range', () => {
    expect(parseExecutorSettings({ maxWorkers: 1, model: null, rootDirectory: null }).maxWorkers).toBe(1)
    expect(parseExecutorSettings({ maxWorkers: 100, model: null, rootDirectory: null }).maxWorkers).toBe(100)
  })

  it('rejects a fractional, out-of-range or non-finite slot count', () => {
    for (const maxWorkers of [0, 101, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => parseExecutorSettings({ maxWorkers, model: null, rootDirectory: null })).toThrow(/并行工单数/)
    }
  })

  it('treats an omitted model or root as unset', () => {
    expect(parseExecutorSettings({ maxWorkers: 5, model: undefined, rootDirectory: '  ' })).toEqual({
      maxWorkers: 5,
      model: null,
      rootDirectory: null,
    })
  })

  it('accepts a complete model selection and rejects an incomplete one', () => {
    expect(
      parseExecutorSettings({
        maxWorkers: 5,
        model: { provider: 'deepseek-official', model: 'deepseek-flash', reasoningEffort: 'high' },
        rootDirectory: null,
      }).model,
    ).toEqual({ provider: 'deepseek-official', model: 'deepseek-flash', reasoningEffort: 'high' })

    expect(() => parseExecutorSettings({ maxWorkers: 5, model: { provider: '', model: 'x' }, rootDirectory: null })).toThrow(
      /服务商/,
    )
    expect(() => parseExecutorSettings({ maxWorkers: 5, model: { provider: 'p', model: '' }, rootDirectory: null })).toThrow(
      /模型/,
    )
    expect(() =>
      parseExecutorSettings({
        maxWorkers: 5,
        model: { provider: 'p', model: 'm', reasoningEffort: ' ' },
        rootDirectory: null,
      }),
    ).toThrow(/推理强度/)
  })

  it('accepts an absolute root and rejects a relative one', () => {
    const parsed = parseExecutorSettings({
      maxWorkers: 5,
      model: null,
      rootDirectory: 'C:\\work\\agent',
    })
    expect(parsed.rootDirectory).toBe('C:\\work\\agent')

    expect(() => parseExecutorSettings({ maxWorkers: 5, model: null, rootDirectory: 'work' })).toThrow(/绝对路径/)
  })

  it('rejects a non-object value', () => {
    expect(() => parseExecutorSettings(null)).toThrow(/执行器/)
    expect(() => parseExecutorSettings([])).toThrow(/执行器/)
  })

  it('applies the default slot count for an omitted value', () => {
    expect(parseExecutorSettings({ model: null, rootDirectory: null }).maxWorkers).toBe(MAX_WORKERS.defaultValue)
  })
})

describe('contract boundaries', () => {
  it('accepts exactly the maximum number of rules and the maximum text lengths', () => {
    const rules = Array.from({ length: PROMPT_LIMITS.rules }, (_, index) =>
      rule({ id: `rule-${index}`, name: 'x'.repeat(PROMPT_LIMITS.ruleName), instruction: 'y'.repeat(PROMPT_LIMITS.ruleInstruction) }),
    )
    expect(parseDispatchRules(rules)).toHaveLength(PROMPT_LIMITS.rules)

    expect(() =>
      parsePromptTexts({
        shared: 's'.repeat(PROMPT_LIMITS.promptPart),
        router: 'r',
        worker: 'w',
      }),
    ).not.toThrow()
  })

  it('rejects a numeric string for the worker-slot count', () => {
    expect(() => parseExecutorSettings({ maxWorkers: '5', model: null, rootDirectory: null })).toThrow(
      /并行工单数/,
    )
  })

  it('accepts UNC and POSIX roots as absolute directories', () => {
    expect(
      parseExecutorSettings({ maxWorkers: 5, model: null, rootDirectory: '\\\\server\\share\\agent' }).rootDirectory,
    ).toBe('\\\\server\\share\\agent')
    expect(parseExecutorSettings({ maxWorkers: 5, model: null, rootDirectory: '/srv/agent' }).rootDirectory).toBe(
      '/srv/agent',
    )
  })

  it('flattens CRLF inside a rule so it still occupies one line', () => {
    const section = composeDispatchSection([rule({ name: '文案\n修正', instruction: '第一行\r\n第二行' })])

    expect(section).toContain('- 文案 修正：第一行 第二行')
    expect(section.split('\n')).toHaveLength(2)
  })

  it('does not leave a blank gap when the shared part has no content after trimming', () => {
    expect(
      composeRolePrompt({ shared: '   ', router: '路由', worker: '执行' }, 'worker'),
    ).toBe('执行')
  })
})

describe('formatWorkerModel', () => {
  it('renders the route and the optional reasoning effort', () => {
    expect(formatWorkerModel({ provider: 'deepseek-official', model: 'deepseek-flash' })).toBe(
      'deepseek-official / deepseek-flash',
    )
    expect(
      formatWorkerModel({ provider: 'deepseek-official', model: 'deepseek-flash', reasoningEffort: 'high' }),
    ).toBe('deepseek-official / deepseek-flash · high')
  })

  it('renders an empty string when no model is configured', () => {
    expect(formatWorkerModel(null)).toBe('')
  })
})
