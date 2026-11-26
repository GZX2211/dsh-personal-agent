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
 * 清空 router 身份槽，供归档事件在新建之前调用。
 *
 * 只删身份不建会话：调用方随后必须 ensureRouterSession，否则本轮没有 router。
 */
export async function releaseRouterIdentity(identities: KvStore): Promise<void> {
  await identities.delete(KV_ROUTER_SESSION)
}

export interface RouterArchiveRebindOptions {
  ctx: HostContext
  stateDirectory: string
  identities: KvStore
  /** 当前 router 身份；只有被归档的正是它才触发重绑。 */
  currentRouterSessionId: () => string | undefined
  /** 新会话已建好并写入身份槽，通知调用方完成装饰等运行时装配。 */
  onRebound: (session: RouterSession) => void | Promise<void>
  log?: (message: string) => void
}

/**
 * 监听归档事件，把 router 身份从一个已归档会话迁到新会话。
 *
 * 空身份槽 + 新建写入新 id 是不可逆的：旧会话日后复原也拿不回 router，
 * 始终只留一个。事件只按 sessionId 认领，不猜归档原因，也不碰别的会话。
 */
export function registerRouterArchiveRebind(options: RouterArchiveRebindOptions): () => void {
  return options.ctx.on('workspace/session-archived', request => {
    if (request.sessionId !== options.currentRouterSessionId()) return
    void (async () => {
      await releaseRouterIdentity(options.identities)
      const session = await ensureRouterSession(options.ctx, options.stateDirectory, options.identities)
      await options.onRebound(session)
    })().catch(error => {
      options.log?.(`router rebind after archive failed: ${error instanceof Error ? error.message : String(error)}`)
    })
  })
}

/**
 * 建好（或复用）路由会话并置顶，幂等。
 *
 * 身份记在账本 kv 里：插件重载或进程重启后再建一次，会在左栏多出一个同名
 * 置顶会话，那不是用户的第二个助手。旧身份文件会被迁移并删除。
 *
 * 归档的会话仍在会话表里，但 pin 与归档互斥，且复原后也不能重新成为 router：
 * 一条归档身份按失效处理，清掉 kv 记录再建新会话。新 id 覆盖旧记录，因此旧会话
 * 即使日后复原也拿不回 router 身份，始终只有一个。
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

/**
 * 依次尝试 kv 与旧文件；归档记录的身份槽会被清空，避免复原后重新绑回。
 *
 * 归档只由宿主记账，会话表里仍在，所以可用性判定必须同时排除归档集合。
 * 身份槽是单值：清掉后新建会写入新 id，旧会话复原也不会再被认作 router。
 */
async function readRecordedIdentity(
  ctx: HostContext,
  directory: string,
  identities: KvStore,
): Promise<RouterSession | undefined> {
  const fromKv = parseIdentity(identities.get(KV_ROUTER_SESSION))
  if (fromKv !== undefined && (await sessionAvailable(ctx, fromKv.sessionId))) return fromKv
  if (fromKv !== undefined && (await sessionArchived(ctx, fromKv.sessionId))) {
    await identities.delete(KV_ROUTER_SESSION)
  }

  const fromLegacy = parseIdentity(await readLegacyRecord(directory))
  if (fromLegacy !== undefined && (await sessionAvailable(ctx, fromLegacy.sessionId))) {
    await identities.set(KV_ROUTER_SESSION, JSON.stringify(fromLegacy))
    await removeLegacyRecord(directory)
    return fromLegacy
  }
  await removeLegacyRecord(directory)
  return undefined
}

/** 归档的会话不算可用：pin 与归档互斥，而 router 每次复用都要 pin。 */
async function sessionAvailable(ctx: HostContext, sessionId: SessionId): Promise<boolean> {
  if (sessionArchived(ctx, sessionId)) return false
  const value = await ctx.sessionController.list({}, new AbortController().signal)
  return value.items.some(item => item.sessionId === sessionId)
}

function sessionArchived(ctx: HostContext, sessionId: SessionId): boolean {
  return ctx.workspaceRegistry.archivedSessionIds.includes(sessionId)
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
