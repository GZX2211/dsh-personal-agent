// collab/scr/asar-extract.mjs
// 从 app.asar 导出某个路径前缀下的文件到磁盘，便于用常规工具阅读。
// 用法：node asar-extract.mjs <asar 内前缀> <目标目录>

import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const ASAR = 'D:\\dsh\\resources\\app.asar'
const prefix = process.argv[2]
const dest = process.argv[3]
if (!prefix || !dest) throw new Error('用法: node asar-extract.mjs <prefix> <dest>')

const buf = readFileSync(ASAR)
const headerPayload = buf.readUInt32LE(4)
const jsonLen = buf.readUInt32LE(12)
const header = JSON.parse(buf.subarray(16, 16 + jsonLen).toString('utf8'))
const baseOffset = 8 + headerPayload

const files = []
function walk(node, path) {
  for (const [name, entry] of Object.entries(node.files ?? {})) {
    const child = path ? `${path}/${name}` : name
    if (entry.files) walk(entry, child)
    else if (entry.offset !== undefined) files.push({ path: child, offset: baseOffset + Number(entry.offset), size: entry.size })
  }
}
walk(header, '')

let count = 0
for (const file of files) {
  if (!file.path.startsWith(prefix)) continue
  const relative = file.path.slice(prefix.length).replace(/^\//, '')
  const target = join(dest, relative)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, buf.subarray(file.offset, file.offset + file.size))
  count += 1
}
console.log(`extracted ${count} files -> ${dest}`)
