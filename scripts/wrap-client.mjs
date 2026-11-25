// scripts/wrap-client.mjs
//
// 把 tsdown 的 lazy-CJS 产物包进浏览器的 `window.__ModuleLoader__.load` 外壳：
// 外壳只提供模块表里的 `require`（react 等基线包由宿主提供），工厂返回 exports。
// 不重排产物正文——正文里可能有模板字符串，改动前后空白会改语义。

import { readFile, rm, writeFile } from 'node:fs/promises'

const PACKAGE_NAME = 'dsh-gzx-agent'
const BODY = new URL('../lib/client.body.js', import.meta.url)
const OUT = new URL('../lib/client.js', import.meta.url)

const body = await readFile(BODY, 'utf8')
if (!body.includes('exports.')) throw new Error('client body has no exports to hand to the module table')

const wrapped = `window.__ModuleLoader__.load({
\tid: ${JSON.stringify(PACKAGE_NAME)},
\tfactory: (require) => {
\t\tvar module = { exports: {} };
\t\tvar exports = module.exports;
${body}
\t\treturn module.exports;
\t}
});
`

await writeFile(OUT, wrapped, 'utf8')
await rm(BODY)
console.log(`wrapped ${OUT.pathname} (${wrapped.length} bytes)`)
