// tests/client/style.test.ts
//
// 样式守卫：组件用到的每个 `pa-*` 类都必须在 style.ts 里有定义。
// 单文件样式表没有编译期检查，漏一条规则不会报错，只会让界面悄悄少一层外观。

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
})
