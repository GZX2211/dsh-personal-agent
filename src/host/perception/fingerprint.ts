// src/host/perception/fingerprint.ts
//
// 外部事实的缺失去重键。
//
// 渠道可以自己给 externalId（文件 mtime、事件 id、脚本输出），给不出时用陈述文本的
// 指纹兜底：同一句话就是同一份事实。指纹只用于去重，不承担身份语义。

import { createHash } from 'node:crypto'

export function statementFingerprint(statement: string): string {
  return createHash('sha256').update(statement, 'utf8').digest('hex').slice(0, 16)
}
