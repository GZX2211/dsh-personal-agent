// tests/host/perception/fs-pattern.test.ts
//
// ignore 模式用自实现的 glob：不引入依赖，语义与常见 glob 一致——`**` 跨目录、
// `*` 不跨分隔符、`/` 与 `\` 等价。模式是用户数据，匹配必须确定。

import { describe, expect, it } from 'vitest'
import { globToRegExp, isIgnored, DEFAULT_IGNORES } from '../../../src/host/perception/fs-pattern.ts'

describe('globToRegExp', () => {
  it('anchors the whole path', () => {
    expect(globToRegExp('*.log').test('a.log')).toBe(true)
    expect(globToRegExp('*.log').test('a.log.bak')).toBe(false)
  })

  it('keeps a single star inside one directory', () => {
    expect(globToRegExp('*.log').test('dir/a.log')).toBe(false)
    expect(globToRegExp('src/*.ts').test('src/a.ts')).toBe(true)
    expect(globToRegExp('src/*.ts').test('src/nested/a.ts')).toBe(false)
  })

  it('lets a double star cross directories', () => {
    expect(globToRegExp('**/*.tmp').test('D:/p/a.tmp')).toBe(true)
    expect(globToRegExp('**/*.tmp').test('D:/p/a/b/c.tmp')).toBe(true)
    expect(globToRegExp('**/node_modules/**').test('D:/p/node_modules/x/y.js')).toBe(true)
  })

  it('matches a double star prefix at the start of a relative path', () => {
    expect(globToRegExp('**/*.tmp').test('a.tmp')).toBe(true)
  })

  it('treats a question mark as one non-separator character', () => {
    expect(globToRegExp('a?.ts').test('ab.ts')).toBe(true)
    expect(globToRegExp('a?.ts').test('a/.ts')).toBe(false)
  })

  it('treats slashes and backslashes as the same separator', () => {
    // 正则本身按 `/` 分隔的路径匹配；Windows 写法由 isIgnored 归一化后再匹配。
    expect(isIgnored('D:\\p\\node_modules\\x.js', ['**/node_modules/**'])).toBe(true)
    expect(isIgnored('D:/p/node_modules/x.js', ['**\\node_modules\\**'])).toBe(true)
  })

  it('escapes regular-expression metacharacters in the pattern', () => {
    expect(globToRegExp('file(.txt').test('file(.txt')).toBe(true)
    expect(globToRegExp('a.b').test('axb')).toBe(false)
  })

  it('matches the shell-quoted temporary file pattern', () => {
    expect(globToRegExp('**/~$*').test('D:/p/~$report.docx')).toBe(true)
  })

  it('lets a middle double star stand for zero directories', () => {
    expect(globToRegExp('a/**/b').test('a/b')).toBe(true)
    expect(globToRegExp('a/**/b').test('a/x/y/b')).toBe(true)
    expect(globToRegExp('a/**/b').test('a/xb')).toBe(false)
  })
})

describe('isIgnored', () => {
  it('ignores node_modules, git and temp files by default', () => {
    expect(isIgnored('D:/p/node_modules/a.js', DEFAULT_IGNORES)).toBe(true)
    expect(isIgnored('D:/p/.git/HEAD', DEFAULT_IGNORES)).toBe(true)
    expect(isIgnored('D:/p/a.tmp', DEFAULT_IGNORES)).toBe(true)
    expect(isIgnored('D:/p/~$a.docx', DEFAULT_IGNORES)).toBe(true)
  })

  it('keeps ordinary files', () => {
    expect(isIgnored('D:/p/src/index.ts', DEFAULT_IGNORES)).toBe(false)
  })

  it('is not influenced by user patterns when none are given', () => {
    expect(isIgnored('D:/p/a.txt', [])).toBe(false)
  })

  it('ignores the directory itself, not just its contents', () => {
    // 递归监听把目录自身的变更也报出来，路径就是目录本身。
    expect(isIgnored('D:/p/node_modules', ['**/node_modules/**'])).toBe(true)
    expect(isIgnored('D:/p/.git', ['**/.git/**'])).toBe(true)
  })
})
