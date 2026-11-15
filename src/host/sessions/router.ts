// src/host/sessions/router.ts
//
// 路由会话：左栏固定区里的那一个，用户对它说话，它把任务派给执行会话。

import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { SessionId } from '@deepseek-ai/dsh-session'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace'
import type { HostContext } from '../context.ts'
import { ensureDirectory } from '../state/directory.ts'

export const ROUTER_WORKSPACE_TITLE = '个人代理'
export const ROUTER_SESSION_TITLE = '个人代理 · 路由'

/** 路由会话身份的最小记录文件名（P1 落到账本 kv 后删除）。 */
const ROUTER_RECORD_FILE = 'router-session.json'

export interface RouterSession {
  workspaceId: WorkspaceId
  sessionId: SessionId
}

/**
 * 建好（或复用）路由会话并置顶，幂等。
 *
 * 复用身份记在状态目录里：插件重载或进程重启后再建一次，会在左栏多出一个同名
 * 置顶会话，那不是用户的第二个助手。身份文件在账本落地前先承担这件事。
 *
 * 工作区目录取状态目录本身：路由会话不该占住用户自己的工作区，也不该在用户
 * 目录里留下会话痕迹。工作区按规范路径复用，重复调用得到同一个。
 */
export async function ensureRouterSession(ctx: HostContext, stateDirectory: string): Promise<RouterSession> {
  const directory = await ensureDirectory(stateDirectory)
  const recorded = await readRecord(directory)
  if (recorded !== undefined && (await sessionExists(ctx, recorded.sessionId))) {
    // 用户可能取消过置顶，这里只是把它恢复；已置顶时该调用是空写。
    await ctx.workspaceRegistry.pinSession(recorded.sessionId)
    return recorded
  }

  const workspace = await ctx.workspaceRegistry.create(directory, ROUTER_WORKSPACE_TITLE)
  // 会话目录来自工作区路径；再传 cwd 会被会话域判为二选一冲突。
  const created = await ctx.sessionController.create({ workspaceId: workspace.id })
  await ctx.sessionController.rename({ sessionId: created.sessionId, title: ROUTER_SESSION_TITLE })
  await ctx.workspaceRegistry.pinSession(created.sessionId)
  const session: RouterSession = { workspaceId: workspace.id, sessionId: created.sessionId }
  await writeRecord(directory, session)
  return session
}

async function sessionExists(ctx: HostContext, sessionId: SessionId): Promise<boolean> {
  const value = await ctx.sessionController.list({}, new AbortController().signal)
  return value.items.some(item => item.sessionId === sessionId)
}

async function readRecord(directory: string): Promise<RouterSession | undefined> {
  try {
    const parsed: unknown = JSON.parse(await readFile(join(directory, ROUTER_RECORD_FILE), 'utf8'))
    if (typeof parsed === 'object' && parsed !== null) {
      const record = parsed as { workspaceId?: unknown; sessionId?: unknown }
      if (typeof record.workspaceId === 'string' && typeof record.sessionId === 'string') {
        return { workspaceId: record.workspaceId as WorkspaceId, sessionId: record.sessionId as SessionId }
      }
    }
  } catch {
    // 文件不存在或已损坏都按「没有记录」处理：重建一个会话比信任坏记录安全。
  }
  return undefined
}

async function writeRecord(directory: string, session: RouterSession): Promise<void> {
  await writeFile(join(directory, ROUTER_RECORD_FILE), `${JSON.stringify(session, null, 2)}\n`, 'utf8')
}
