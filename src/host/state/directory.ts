// src/host/state/directory.ts
//
// 插件私有状态目录：账本、工单工作目录都落在它下面。

import { mkdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

/**
 * 状态目录的默认值：`<DSH_HOME>/state/personal-agent`。
 *
 * profile 启动的 Harness 一定带着 `DSH_HOME`；没有它时（无 profile 启动）退回
 * `~/.dsh`，与 DSH 自己的默认根一致，避免写到进程工作目录里。
 */
export function resolveStateDirectory(override?: string): string {
  const configured = override?.trim()
  if (configured !== undefined && configured.length > 0) return configured
  const home = process.env.DSH_HOME?.trim()
  const root = home !== undefined && home.length > 0 ? home : join(homedir(), '.dsh')
  return join(root, 'state', 'personal-agent')
}

/** 幂等建目录，返回原路径，便于链式使用。 */
export async function ensureDirectory(path: string): Promise<string> {
  await mkdir(path, { recursive: true })
  return path
}
