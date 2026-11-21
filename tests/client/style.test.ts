// tests/client/style.test.ts
//
// 样式守卫：
// - 组件用到的每个 `pa-*` 类都必须在 style.ts 里有定义；
// - 官方原子包已经提供的控件不得在本插件里复刻第二份；
// - 过滤条与列表行必须从官方 primitives 取控件。

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CONSOLE_CSS } from '../../src/client/style.ts'

const CLIENT_DIR = join(process.cwd(), 'src', 'client')

function sourceFiles(directory: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...sourceFiles(path))
    else if (entry.name.endsWith('.tsx')) files.push(path)
  }
  return files
}

/** className 里出现的类名；模板字符串只取其字面前缀。 */
function classNames(files: readonly string[]): string[] {
  const names: string[] = []
  for (const file of files) {
    const text = readFileSync(file, 'utf8')
    for (const match of text.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
      const value = match[1] ?? match[2] ?? ''
      for (const token of value.split(/\s+/)) {
        if (token.startsWith('pa-')) names.push(token)
      }
    }
  }
  return names
}

describe('style.ts', () => {
  it('defines every class the components render', () => {
    const defined = new Set(
      [...CONSOLE_CSS.matchAll(/\.(pa-[A-Za-z0-9_-]+)/g)]
        .map(match => match[1])
        .filter((name): name is string => name !== undefined),
    )
    const missing = classNames(sourceFiles(CLIENT_DIR)).filter(token => {
      if (!token.includes('${')) return !defined.has(token)
      // 模板类（如 `pa-button--${variant}`）：至少有一个具体变体被定义。
      const prefix = token.slice(0, token.indexOf('${'))
      return ![...defined].some(name => name.startsWith(prefix))
    })

    expect(missing).toEqual([])
  })

  it('does not reimplement a control the shared primitives already ship', () => {
    for (const selector of [
      '.pa-capsule',
      '.pa-search__input',
      '.pa-badge',
      '.pa-button',
      '.pa-icon-button',
      '.pa-help-pop',
      '.pa-card__option-row',
    ]) {
      expect(CONSOLE_CSS).not.toContain(selector)
    }
  })

  it('takes the toolbar and list rows from the shared primitives', () => {
    const filterBar = readFileSync(join(CLIENT_DIR, 'components', 'FilterBar.tsx'), 'utf8')
    const listRow = readFileSync(join(CLIENT_DIR, 'components', 'ListRow.tsx'), 'utf8')

    expect(filterBar).toContain("from '@deepseek-ai/dsh-client-ui-primitives'")
    expect(filterBar).toContain('Pill')
    expect(filterBar).toContain('Input')
    expect(listRow).toContain("from '@deepseek-ai/dsh-client-ui-primitives'")
    expect(listRow).toContain('Tooltip')
    expect(listRow).toContain('Tag')
  })

  it('keeps the toolbar search compact and the list free of horizontal scrolling', () => {
    expect(CONSOLE_CSS).toMatch(/\.pa-toolbar__search\s*\{[^}]*height:\s*28px/)
    expect(CONSOLE_CSS).toMatch(/\.pa-list\s*\{[^}]*overflow-x:\s*hidden/)
  })

  it('keeps the settings save bar in reach while the form scrolls', () => {
    const block = /\.pa-settings__savebar\s*\{([^}]*)\}/.exec(CONSOLE_CSS)?.[1] ?? ''
    expect(block).toMatch(/position:\s*sticky/)
    expect(block).toMatch(/bottom:\s*0/)
    expect(block).toMatch(/padding:\s*8px 12px/)
    expect(block).toMatch(/background:\s*var\(--dsw-alias-bg-base/)
    // 按钮直接落在面板底色上，不再额外画一条灰色操作条。
    expect(block).not.toMatch(/(^|\n)\s*border(-[a-z]+)?\s*:/)
  })

  it('sizes the row editor inside its card', () => {
    const block = /\.pa-rule__input\s*\{([^}]*)\}/.exec(CONSOLE_CSS)?.[1] ?? ''
    expect(block).toMatch(/box-sizing:\s*border-box/)
    expect(block).toMatch(/width:\s*100%/)
  })

  it('paints settings inputs with the official settings-field surface', () => {
    // 官方 ConfigField 用 bg-layer-3；bg-overlay 在深色主题里接近白，阅读时刺眼。
    for (const selector of ['.pa-settings__select', '.pa-settings__textarea', '.pa-settings__pre']) {
      expect(CONSOLE_CSS).toMatch(
        new RegExp(`${selector.replace('.', '\\.')}\\s*\\{[^}]*background:\\s*var\\(--dsw-alias-bg-layer-3\\)`),
      )
    }
  })
})
