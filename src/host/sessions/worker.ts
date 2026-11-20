// src/host/sessions/worker.ts
//
// 执行会话：一个工单一个会话，落在独立工作区里，目录按工单隔离。
// 工作区根目录来自执行器设置，目录本身仍按工单隔离。

import { join } from 'node:path'
import type { SessionId } from '@deepseek-ai/dsh-session'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace'
import type { WorkerModel } from '../../shared/settings.ts'
import { shortTicketId } from '../../shared/tickets.ts'
import type { HostContext } from '../context.ts'
import { ensureDirectory } from '../state/directory.ts'
import { seedWorkerModel } from './model.ts'

const WORKER_WORKSPACE_TITLE = '个人代理 · 工单'

export interface WorkerSessionSeed {
  ticketId: string
  /** 工单标题，写进会话标题，让左栏能认出这是哪一单。 */
  title: string
  /** 工单工作目录；缺省为 `<root>/<ticketId>`。 */
  directory?: string
  /** 执行器配置的模型；null/缺省表示继承 DSH 默认。 */
  model?: WorkerModel | null
  /** 模型播种失败的降级日志：模型不可用不该拦住工单。 */
  log?: (message: string) => void
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
  root: string,
  seed: WorkerSessionSeed,
): Promise<WorkerSession> {
  const base = await ensureDirectory(root)
  const workspace = await ctx.workspaceRegistry.create(base, WORKER_WORKSPACE_TITLE)
  const directory = await ensureDirectory(seed.directory ?? join(base, seed.ticketId))
  const created = await ctx.sessionController.create({ workspaceId: workspace.id })
  const resolved = await ctx.sessionController.resolveAgent(created.sessionId)
  if (!('agent' in resolved)) {
    throw new Error(`worker session ${created.sessionId} has no live agent: ${resolved.error.code}`)
  }
  if (seed.model !== undefined && seed.model !== null) {
    try {
      await seedWorkerModel(ctx, resolved.agent, seed.model)
    } catch (error) {
      // 模型不可用（目录变化、服务缺失）时这一单仍要跑：退回 DSH 默认模型。
      seed.log?.(`worker ${created.sessionId} keeps the default model: ${describe(error)}`)
    }
  }
  await ctx.workingDirectory.set(resolved.agent, directory)
  await ctx.sessionController.rename({
    sessionId: created.sessionId,
    title: `${seed.title} · 工单 #${shortTicketId(seed.ticketId)}`,
  })
  return { workspaceId: workspace.id, sessionId: created.sessionId, directory }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
