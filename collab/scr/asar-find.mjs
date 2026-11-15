// collab/scr/asar-find.mjs
// 在 app.asar 中按关键字定位文件（原生 rg 无法进入 asar）。
// 用法：node asar-find.mjs <关键字> [--context=N]

import { readFileSync } from 'node:fs'

const ASAR = 'D:\\dsh\\resources\\app.asar'
const needle = process.argv[2] ?? 'ask_user_question'
const ctxArg = process.argv.find(a => a.startsWith('--context='))
const ctxLen = ctxArg ? Number(ctxArg.split('=')[1]) : 0

const buf = readFileSync(ASAR)

// asar：文件头是一个 Pickle。前 4 字节是 size pickle 的载荷长度(4)，
// 接下来 4 字节是头部载荷长度 size；头部载荷从 8 开始，其前 4 字节是 JSON 字符串长度。
const headerPayload = buf.readUInt32LE(4)
const jsonLen = buf.readUInt32LE(12)
const header = JSON.parse(buf.subarray(16, 16 + jsonLen).toString('utf8'))
const baseOffset = 8 + headerPayload

const files = []
function walk(node, prefix) {
  for (const [name, entry] of Object.entries(node.files ?? {})) {
    const path = prefix ? `${prefix}/${name}` : name
    if (entry.files) walk(entry, path)
    else if (entry.offset !== undefined) files.push({ path, offset: baseOffset + Number(entry.offset), size: entry.size })
  }
}
walk(header, '')
files.sort((a, b) => a.offset - b.offset)

const counts = new Map()
const contexts = []
const needleBuf = Buffer.from(needle, 'utf8')
let index = 0
let cursor = 0
while (index >= 0) {
  index = buf.indexOf(needleBuf, index)
  if (index < 0) break
  while (cursor + 1 < files.length && files[cursor + 1].offset <= index) cursor += 1
  const file = files[cursor]
  const inFile = file && index < file.offset + file.size
  const key = inFile ? file.path : '(out-of-file)'
  counts.set(key, (counts.get(key) ?? 0) + 1)
  if (ctxLen > 0 && contexts.length < 40) {
    contexts.push(`${key}@${index - (file?.offset ?? 0)}\n${buf.subarray(Math.max(0, index - ctxLen), index + ctxLen).toString('utf8')}`)
  }
  index += 1
}

console.log(`files=${files.length} hits=${[...counts.values()].reduce((a, b) => a + b, 0)}`)
const sorted = [...counts].sort((a, b) => b[1] - a[1])
for (const [path, count] of sorted) console.log(`${count}\t${path}`)
if (ctxLen > 0) {
  console.log('==== contexts ====')
  for (const block of contexts) console.log(`--- ${block}`)
}
