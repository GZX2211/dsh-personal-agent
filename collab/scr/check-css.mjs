// collab/scr/check-css.mjs
//
// 校验面板样式字符串是否还是合法 CSS。
//
// 起因：一次多行文本替换把字面量 `?` 插进了 CSS 声明之间，CSS 解析器丢弃了
// 整条标签栏规则，界面看起来「整个崩掉」。这类污染在类型检查与单测里都看不见，
// 只能在构建前单独校验。

import { readFileSync } from 'node:fs'

const SOURCE = new URL('../../src/client/style.ts', import.meta.url)
const MARK = 'export const CONSOLE_CSS = `'

const text = readFileSync(SOURCE, 'utf8')
const start = text.indexOf(MARK)
if (start < 0) throw new Error('style.ts does not export CONSOLE_CSS')
const bodyStart = start + MARK.length
const bodyEnd = text.lastIndexOf('`')
if (bodyEnd <= bodyStart) throw new Error('CONSOLE_CSS template is not closed')
const css = text.slice(bodyStart, bodyEnd)

const problems = []

// 1) 非法 token：CSS 里不该出现问号。
const questions = css.split('\n').flatMap((line, index) => (line.includes('?') ? [`line ${String(index + 1)}: ${line.trim()}`] : []))
problems.push(...questions.map(item => `stray "?": ${item}`))

// 2) 花括号必须配对。
let depth = 0
css.split('\n').forEach((line, index) => {
  for (const character of line) {
    if (character === '{') depth += 1
    if (character === '}') {
      depth -= 1
      if (depth < 0) problems.push(`line ${String(index + 1)}: unbalanced "}"`)
    }
  }
})
if (depth !== 0) problems.push(`unbalanced braces at end: ${String(depth)}`)

// 3) 每个非注释行必须以 { } ; 或逗号（多选择器）结束。
css.split('\n').forEach((line, index) => {
  const trimmed = line.trim()
  if (trimmed === '') return
  if (trimmed.startsWith('/*') || trimmed.endsWith('*/')) return
  if (/[{};,]$/.test(trimmed)) return
  problems.push(`line ${String(index + 1)} does not end a declaration: ${trimmed}`)
})

if (problems.length > 0) {
  console.error(problems.map(item => `FAIL ${item}`).join('\n'))
  throw new Error(`panel CSS is not well-formed (${String(problems.length)} problems)`)
}

console.log(`PASS panel CSS is well-formed (${String(css.length)} chars)`)
