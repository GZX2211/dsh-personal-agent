// src/host/sessions/router.ts
//
// 路由会话：左栏固定区里的那一个，用户对它说话，它把任务派给执行会话。

import { readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import type { SessionId } from '@deepseek-ai/dsh-session'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace'
import type { HostContext } from '../context.ts'
import { ensureDirectory } from '../state/directory.ts'
import type { KvStore } from '../store/kv-store.ts'

const ROUTER_WORKSPACE_TITLE = '个人代理'
export const ROUTER_SESSION_TITLE = '个人代理 · 路由'

/** 账本 kv 里的技术元数据键：router 身份允许改写。 */
const KV_ROUTER_SESSION = 'router.session'

/** P1 之前的身份文件；只在迁移时读取，迁移后删除。 */
const LEGACY_RECORD_FILE = 'router-session.json'

export interface RouterSession {
  workspaceId: WorkspaceId
  sessionId: SessionId
}

/**
 * 建好（或复用）路由会话并置顶，幂等。
 *
 * 身份记在账本 kv 里：插件重载或进程重启后再建一次，会在左栏多出一个同名
 * 置顶会话，那不是用户的第二个助手。旧身份文件会被迁移并删除。
 *
 * 工作区目录取状态目录本身：路由会话不该占住用户自己的工作区，也不该在用户
 * 目录里留下会话痕迹。工作区按规范路径复用，重复调用得到同一个。
 */
export async function ensureRouterSession(
  ctx: HostContext,
  stateDirectory: string,
  identities: KvStore,
): Promise<RouterSession> {
  const directory = await ensureDirectory(stateDirectory)
  const recorded = await readRecordedIdentity(ctx, directory, identities)
  if (recorded !== undefined) {
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
  await identities.set(KV_ROUTER_SESSION, JSON.stringify(session))
  return session
}

/** 依次尝试 kv 与旧文件；两条路都不成立时把旧文件清掉，避免下次继续误读。 */
async function readRecordedIdentity(
  ctx: HostContext,
  directory: string,
  identities: KvStore,
): Promise<RouterSession | undefined> {
  const fromKv = parseIdentity(identities.get(KV_ROUTER_SESSION))
  if (fromKv !== undefined && (await sessionExists(ctx, fromKv.sessionId))) return fromKv

  const fromLegacy = parseIdentity(await readLegacyRecord(directory))
  if (fromLegacy !== undefined && (await sessionExists(ctx, fromLegacy.sessionId))) {
    await identities.set(KV_ROUTER_SESSION, JSON.stringify(fromLegacy))
    await removeLegacyRecord(directory)
    return fromLegacy
  }
  await removeLegacyRecord(directory)
  return undefined
}

async function sessionExists(ctx: HostContext, sessionId: SessionId): Promise<boolean> {
  const value = await ctx.sessionController.list({}, new AbortController().signal)
  return value.items.some(item => item.sessionId === sessionId)
}

function parseIdentity(text: string | undefined): RouterSession | undefined {
  if (text === undefined) return undefined
  try {
    const parsed: unknown = JSON.parse(text)
    if (typeof parsed !== 'object' || parsed === null) return undefined
    const record = parsed as { workspaceId?: unknown; sessionId?: unknown }
    if (typeof record.workspaceId === 'string' && typeof record.sessionId === 'string') {
      return { workspaceId: record.workspaceId as WorkspaceId, sessionId: record.sessionId as SessionId }
    }
  } catch {
    // 坏记录按「没有记录」处理：重建一个会话比信任坏记录安全。
  }
  return undefined
}

async function readLegacyRecord(directory: string): Promise<string | undefined> {
  try {
    return await readFile(join(directory, LEGACY_RECORD_FILE), 'utf8')
  } catch {
    return undefined
  }
}

async function removeLegacyRecord(directory: string): Promise<void> {
  await rm(join(directory, LEGACY_RECORD_FILE), { force: true })
}
