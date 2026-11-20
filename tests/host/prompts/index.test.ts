// tests/host/prompts/index.test.ts
//
// 提示词是随包分发的文本资源：加载器必须能从包根找到 prompts/*.md，
// 并按「一句一行」的书写约定拼回段落；文件缺失或为空必须响亮失败。

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { joinPromptMarkdown, defaultPromptTexts, loadPrompt } from '../../../src/host/prompts/index.ts'

describe('joinPromptMarkdown', () => {
  it('joins Chinese sentences without inserting spaces', () => {
    expect(joinPromptMarkdown('第一句。\n第二句。\n')).toBe('第一句。第二句。')
  })

  it('joins Latin sentences with a space after the punctuation', () => {
    expect(joinPromptMarkdown('First sentence.\nSecond sentence.\n')).toBe('First sentence. Second sentence.')
  })

  it('keeps blank lines as paragraph breaks', () => {
    expect(joinPromptMarkdown('第一段。\n\n第二段。')).toBe('第一段。\n\n第二段。')
  })

  it('normalizes CRLF and trailing spaces', () => {
    expect(joinPromptMarkdown('第一句。  \r\n第二句。\r\n')).toBe('第一句。第二句。')
  })
})

describe('defaultPromptTexts', () => {
  it('returns the three shipped prompts as the version-zero baseline', () => {
    const texts = defaultPromptTexts()

    expect(texts.shared).toBe(loadPrompt('shared'))
    expect(texts.router).toBe(loadPrompt('router'))
    expect(texts.worker).toBe(loadPrompt('worker'))
  })
})

describe('loadPrompt', () => {
  it('loads every shipped prompt', () => {
    for (const name of ['shared', 'router', 'worker'] as const) {
      const text = loadPrompt(name)
      expect(text.length).toBeGreaterThan(0)
      expect(text).not.toMatch(/\r/)
    }
  })

  it('loads the role-specific instructions', () => {
    expect(loadPrompt('router')).toContain('pa_task_route')
    expect(loadPrompt('router')).toContain('pa_ledger_query')
    expect(loadPrompt('worker')).toContain('pa_approval_submit')
    expect(loadPrompt('shared')).toContain('账本')
  })

  it('fails loudly for a missing prompt file', () => {
    expect(() => loadPrompt('missing' as never)).toThrow(/missing prompt file/)
  })

  it('ships the prompts directory with the package', () => {
    const manifest = JSON.parse(
      readFileSync(fileURLToPath(new URL('../../../package.json', import.meta.url)), 'utf8'),
    ) as { files?: string[] }

    expect(manifest.files).toContain('prompts')
  })
})
