// tests/client/style.test.ts
//
// 样式守卫：
// - 组件用到的每个 `pa-*` 类都必须在样式片段里有定义；
// - 官方原子包已经提供的控件不得在本插件里复刻第二份；
// - 过滤条与列表行必须从官方 primitives 取控件；
// - 设计变量只有一个来源（tokens.ts），其余片段只能引用；
// - Tab 条与官方标签页对齐，尺寸与横线被显式锁定。

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CONSOLE_CSS } from '../../src/client/styles/index.ts'
import { TOKENS_CSS } from '../../src/client/styles/tokens.ts'

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
      for (const raw of value.split(/\s+/)) {
        // 模板字符串里的条件类名形如 `'pa-row--interactive'`，去掉包裹的引号。
        const token = raw.replace(/^['"]+|['"]+$/g, '')
        if (token.startsWith('pa-')) names.push(token)
      }
    }
  }
  return names
}

function ruleBlock(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?:^|\\n)[\\t ]*${escaped}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? ''
}

function tokenValue(name: string): string | undefined {
  return new RegExp(`--pa-${name}:\\s*([^;]+);`).exec(TOKENS_CSS)?.[1]?.trim()
}

/** 把 var(--pa-*) 展开回具体值，用于验证 Token 化没有改变样式取值。 */
function resolve(css: string): string {
  let out = css
  for (let round = 0; round < 5; round += 1) {
    out = out.replace(/var\(--pa-([a-z0-9-]+)\)/gi, (whole, name: string) => tokenValue(name) ?? whole)
  }
  return out
}

describe('style fragments', () => {
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
    const search = ruleBlock(CONSOLE_CSS, '.pa-toolbar__search')
    expect(search).toContain('height: var(--pa-control-height-sm)')
    expect(resolve(search)).toMatch(/height:\s*28px/)

    const list = ruleBlock(CONSOLE_CSS, '.pa-list')
    expect(list).toContain('overflow-x: hidden')
  })

  it('keeps the settings save bar in reach while the form scrolls', () => {
    const block = ruleBlock(CONSOLE_CSS, '.pa-settings__savebar')
    expect(block).toMatch(/position:\s*sticky/)
    expect(block).toMatch(/bottom:\s*0/)
    expect(resolve(block)).toMatch(/padding:\s*8px 12px/)
    expect(block).toMatch(/background:\s*var\(--dsw-alias-bg-base/)
    // 按钮直接落在面板底色上，不再额外画一条灰色操作条。
    expect(block).not.toMatch(/(^|\n)\s*border(-[a-z]+)?\s*:/)
  })

  it('sizes the row editor inside its card', () => {
    const block = ruleBlock(CONSOLE_CSS, '.pa-rule__input')
    expect(block).toMatch(/box-sizing:\s*border-box/)
    expect(block).toMatch(/width:\s*100%/)
  })

  it('paints settings inputs with the official settings-field surface', () => {
    // 官方 ConfigField 用 bg-layer-3；bg-overlay 在深色主题里接近白，阅读时刺眼。
    for (const selector of ['.pa-settings__select', '.pa-settings__textarea', '.pa-settings__pre']) {
      expect(ruleBlock(CONSOLE_CSS, selector)).toMatch(/background:\s*var\(--dsw-alias-bg-layer-3\)/)
    }
  })

  it('declares every referenced token exactly once', () => {
    const defined = [...TOKENS_CSS.matchAll(/--pa-([a-z0-9-]+):/gi)].map(match => match[1])
    expect(defined.length).toBe(new Set(defined).size)

    const referenced = [...CONSOLE_CSS.matchAll(/var\(--pa-([a-z0-9-]+)\)/gi)].map(match => match[1])
    const undefinedRefs = [...new Set(referenced)].filter(name => !defined.includes(name))
    expect(undefinedRefs).toEqual([])
  })

  it('keeps literal design values out of the domain fragments', () => {
    const domainCss = CONSOLE_CSS.slice(TOKENS_CSS.length)
    const literals: Array<[string, RegExp]> = [
      ['font-size', /font-size:\s*[0-9]/],
      ['line-height', /line-height:\s*[0-9]/],
      ['font-weight', /font-weight:\s*[0-9]/],
      ['border-radius', /border-radius:\s*[1-9]/],
      ['spacing', /(?:^|[;{\s])(?:padding|margin|gap)(?:-[a-z]+)?:\s*[^;]*[0-9]px/],
      ['z-index', /z-index:\s*[0-9]/],
      ['font-family', /font-family:(?!\s*var\(--pa-)/],
      ['color literal', /#[0-9a-fA-F]{3,8}/],
      ['color function', /rgba?\(/],
      ['focus ring', /outline:\s*[0-9]/],
    ]
    for (const [label, pattern] of literals) {
      expect({ label, match: pattern.exec(domainCss)?.[0] }).toEqual({ label, match: undefined })
    }
  })

  it('locks the tab strip to the official geometry', () => {
    const tabs = ruleBlock(CONSOLE_CSS, '.pa-console__tabs')
    const resolved = resolve(tabs)
    expect(resolved).toMatch(/min-height:\s*38px/)
    expect(resolved).toMatch(/padding:\s*0 16px/)
    expect(resolved).toMatch(/gap:\s*0 24px/)
    expect(tabs).toContain('border-bottom: var(--pa-hairline) solid var(--dsw-alias-border-l2)')

    const tab = ruleBlock(CONSOLE_CSS, '.pa-console__tab')
    const resolvedTab = resolve(tab)
    expect(resolvedTab).toMatch(/font-size:\s*13px/)
    expect(resolvedTab).toMatch(/line-height:\s*20px/)
    expect(resolvedTab).toMatch(/font-weight:\s*500/)
  })

  it('keeps one type scale and one line-height scale', () => {
    const fontSizes = [...TOKENS_CSS.matchAll(/--pa-font-size-[a-z0-9-]+:\s*(\d+px);/g)].map(match => match[1])
    expect(new Set(fontSizes)).toEqual(new Set(['18px', '16px', '14px', '13px', '12px', '11px', '10px']))

    const lineHeights = [...TOKENS_CSS.matchAll(/--pa-line-height-[a-z0-9-]+:\s*(\d+px);/g)].map(match => match[1] ?? '')
    expect(new Set(lineHeights)).toEqual(new Set(['24px', '22px', '20px', '18px', '16px', '14px']))
  })

  it('keeps only the official radius scale plus 1px/2px micro corners', () => {
    const radii = [...TOKENS_CSS.matchAll(/--pa-radius-[a-z0-9-]+:\s*([^;]+);/g)].map(match => (match[1] ?? '').trim())
    for (const value of radii) {
      expect(['1px', '2px', '999px', '50%', 'var(--dsw-radius-xs)', 'var(--dsw-radius-sm)', 'var(--dsw-radius-md)']).toContain(value)
    }
  })

  it('keeps two control heights for compact and standard buttons', () => {
    const open = ruleBlock(CONSOLE_CSS, '.pa-td__open')
    expect(open).toContain('height: var(--pa-control-height-xs)')
    expect(resolve(open)).toContain('height: 24px')
    expect(open).toContain('border-radius: var(--pa-radius-sm)')

    const chainAction = ruleBlock(CONSOLE_CSS, '.pa-chain__action')
    expect(resolve(chainAction)).toContain('height: 24px')

    const foldButton = ruleBlock(CONSOLE_CSS, '.pa-fold__button')
    expect(resolve(foldButton)).toContain('height: 28px')

    const back = ruleBlock(CONSOLE_CSS, '.pa-td__back')
    expect(resolve(back)).toContain('width: 24px')
    expect(resolve(back)).toContain('height: 24px')
  })

  it('renders self-drawn tags at the shared tag size', () => {
    for (const selector of ['.pa-chain__kind', '.pa-stream__kind', '.pa-timeline__origin-kind']) {
      const block = ruleBlock(CONSOLE_CSS, selector)
      expect(resolve(block)).toContain('height: 20px')
      expect(resolve(block)).toContain('font-size: 11px')
    }
  })
})
