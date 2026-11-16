// tests/client/i18n.test.ts
//
// 词典守卫：中英两份必须同键，且每个键都得有真实使用点。
// 卡片改版后遗留的未用键不会报错，只会让翻译白做——这条测试把它拦在提交前。

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { en, zh } from '../../src/client/i18n.ts'

const CLIENT_DIR = join(process.cwd(), 'src', 'client')
const DICTIONARY_FILE = join(CLIENT_DIR, 'i18n.ts')

function sourceFiles(directory: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...sourceFiles(path))
    else if (/\.[cm]?[jt]sx?$/.test(entry.name) && path !== DICTIONARY_FILE) files.push(path)
  }
  return files
}

/** 词典键在组件/纯逻辑里以字符串字面量出现，才算真正被使用。 */
function usedKeys(files: readonly string[]): Set<string> {
  const used = new Set<string>()
  for (const file of files) {
    const text = readFileSync(file, 'utf8')
    for (const match of text.matchAll(/['"`]([A-Za-z][A-Za-z0-9_]*)['"`]/g)) {
      if (match[1] !== undefined) used.add(match[1])
    }
  }
  return used
}

describe('i18n 词典', () => {
  it('keeps zh and en on the same key set', () => {
    expect(Object.keys(zh).sort()).toEqual(Object.keys(en).sort())
  })

  it('has no key without a use site', () => {
    const used = usedKeys(sourceFiles(CLIENT_DIR))
    const unused = Object.keys(zh).filter(key => !used.has(key))
    expect(unused).toEqual([])
  })
})
