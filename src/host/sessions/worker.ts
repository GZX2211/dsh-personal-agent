// src/host/sessions/worker.ts
//
// 执行会话：一个工单一个会话，落在独立工作区里，目录按工单隔离。

import { join } from 'node:path'
import type { SessionId } from '@deepseek-ai/dsh-session'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace'
import type { HostContext } from '../context.ts'
import { ensureDirectory } from '../state/directory.ts'
import { shortTicketId } from '../tickets/ids.ts'

export const WORKER_WORKSPACE_TITLE = '个人代理 · 工单'

export interface WorkerSessionSeed {
  ticketId: string
  /** 工单标题，写进会话标题，让左栏能认出这是哪一单。 */
  title: string
  /** 工单工作目录；缺省为 `<state>/work/<ticketId>`。 */
  directory?: string
}

export interface WorkerSession {
  workspaceId: WorkspaceId
  sessionId: SessionId
  directory: string
}

/**
 * 放行时才建会话：排队中的工单在左栏不该有任何痕迹。
 *
 * 会话建在工单工作区里，再把它自己的工作目录收到本工的目录：会话域不接受
 * `workspaceId` 与 `cwd` 同时给出，所以目录这一步走工作目录服务，并且它本身
 * 就是一次模型可见的、可回溯的变更。目录先建好再建会话，避免执行会话拿到
 * 一个不存在的工作目录。
 */
export async function createWorkerSession(
  ctx: HostContext,
  stateDirectory: string,
  seed: WorkerSessionSeed,
): Promise<WorkerSession> {
  const root = await ensureDirectory(join(stateDirectory, 'work'))
  const workspace = await ctx.workspaceRegistry.create(root, WORKER_WORKSPACE_TITLE)
  const directory = await ensureDirectory(seed.directory ?? join(root, seed.ticketId))
  const created = await ctx.sessionController.create({ workspaceId: workspace.id })
  const resolved = await ctx.sessionController.resolveAgent(created.sessionId)
  if (!('agent' in resolved)) {
    throw new Error(`worker session ${created.sessionId} has no live agent: ${resolved.error.code}`)
  }
  await ctx.workingDirectory.set(resolved.agent, directory)
  await ctx.sessionController.rename({
    sessionId: created.sessionId,
    title: `${seed.title} · 工单 #${shortTicketId(seed.ticketId)}`,
  })
  return { workspaceId: workspace.id, sessionId: created.sessionId, directory }
}
