// collab/scr/check-css-bundle.mjs
//
// 校验构建产物里的面板 CSS：源码合法不代表打包后合法（转义、拼接都可能出错）。
// 与 check-css.mjs 互补：那个看源码，这个看 lib/client.js。

import { readFileSync } from 'node:fs'

const bundle = readFileSync(new URL('../../lib/client.js', import.meta.url), 'utf8')
const marker = '── 面板骨架'
const at = bundle.indexOf(marker)
if (at < 0) throw new Error('panel CSS not found in lib/client.js')

let start = at
while (start > 0 && bundle[start] !== '`' && bundle[start] !== '"' && bundle[start] !== "'") start -= 1
const quote = bundle[start]
let end = at
while (end < bundle.length && bundle[end] !== quote) end += 1
const css = bundle.slice(start + 1, end)

const problems = []
if (css.includes('?')) problems.push('CSS contains a stray "?"')
let depth = 0
for (const character of css) {
  if (character === '{') depth += 1
  if (character === '}') {
    depth -= 1
    if (depth < 0) problems.push('unbalanced "}"')
  }
}
if (depth !== 0) problems.push(`unbalanced braces at end: ${String(depth)}`)
for (const needle of ['.pa-console__tabs', 'gap: 0 32px', 'min-height: 38px', 'padding: 0 16px', '.pa-card']) {
  if (!css.includes(needle)) problems.push(`missing rule fragment: ${needle}`)
}

if (problems.length > 0) {
  console.error(problems.map(item => `FAIL ${item}`).join('\n'))
  throw new Error(`bundled CSS is not well-formed (${String(problems.length)} problems)`)
}

console.log(`PASS bundled CSS is well-formed (${String(css.length)} chars)`)
