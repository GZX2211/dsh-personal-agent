// collab/scr/asar-list.mjs
// 列出 app.asar 中路径包含给定子串的文件。
// 用法：node asar-list.mjs <子串> [上限]

import { readFileSync } from 'node:fs'

const ASAR = 'D:\\dsh\\resources\\app.asar'
const needle = process.argv[2] ?? ''
const limit = Number(process.argv[3] ?? 200)

const buf = readFileSync(ASAR)
const headerPayload = buf.readUInt32LE(4)
const jsonLen = buf.readUInt32LE(12)
const header = JSON.parse(buf.subarray(16, 16 + jsonLen).toString('utf8'))

const hits = []
function walk(node, path) {
  for (const [name, entry] of Object.entries(node.files ?? {})) {
    const child = path ? `${path}/${name}` : name
    if (entry.files) walk(entry, child)
    else if (child.includes(needle)) hits.push(child)
  }
}
walk(header, '')
for (const path of hits.slice(0, limit)) console.log(path)
console.log(`total=${hits.length}`)
