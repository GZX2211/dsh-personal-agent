// collab/scr/clean-question-marks.mjs
// 一次性修复：PowerShell 多行替换把字面量 `?` 插进了 CSS 声明之间。
// 污染形态是「分号后续行只有一个问号」，所以只删除整行仅含 `?` 的行。

import { readFileSync, writeFileSync } from 'node:fs'

const target = process.argv[2]
if (!target) throw new Error('用法: node clean-question-marks.mjs <file>')

const before = readFileSync(target, 'utf8')
const after = before.replace(/^[ \t]*\?[ \t]*\r?\n/gm, '')
writeFileSync(target, after, 'utf8')

const removed = (before.match(/^[ \t]*\?[ \t]*\r?\n/gm) ?? []).length
console.log(`${target}: removed ${removed} stray question-mark lines`)
