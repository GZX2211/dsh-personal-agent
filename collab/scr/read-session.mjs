// collab/scr/read-session.mjs
//
// 读一条会话日志（.jsonl.zstd）：打印标题变更、投递消息与末条助手回复。
// 用法：node collab/scr/read-session.mjs <session.v4.jsonl.zstd>

import { readFileSync } from 'node:fs'
import { zstdDecompressSync } from 'node:zlib'

const file = process.argv[2]
if (!file) throw new Error('usage: node read-session.mjs <session.v4.jsonl.zstd>')

const text = zstdDecompressSync(readFileSync(file)).toString('utf8')
const events = text
  .split('\n')
  .filter(line => line.trim().length > 0)
  .map(line => JSON.parse(line))

console.log('events:', events.length)
console.log('first:', JSON.stringify(events[0]).slice(0, 400))

for (const event of events) {
  const data = event.data ?? event
  if (event.type === 'session/title' || event.type === 'session/renamed') {
    console.log('TITLE:', JSON.stringify(data))
  }
  if (event.type === 'user/message') {
    const blocks = data.content ?? []
    const text = blocks.filter(block => block.type === 'text').map(block => block.text).join(' / ')
    console.log('USER:', data.id, '| source:', JSON.stringify(data.source), '|', text.slice(0, 120))
  }
  if (event.type === 'assistant/message') {
    const blocks = data.content ?? []
    const text = blocks.filter(block => block.type === 'text').map(block => block.text).join(' / ')
    if (text.length > 0) console.log('ASSISTANT:', text.slice(0, 200))
  }
  if (event.type === 'turn/end') console.log('TURN-END:', JSON.stringify(data).slice(0, 200))
}
