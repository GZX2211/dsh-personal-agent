// src/host/dev/smoke.ts
//
// P0 冒烟面：把「面板里能看到的、进程内能验证的」通道一次性跑一遍，并把浏览器侧
// 上报的事实攒起来供本机读取。P0 验收后整份删除，业务代码不得依赖这里的任何东西。

import { join } from 'node:path'
import type { SessionId } from '@deepseek-ai/dsh-session'
import type { BeaconRecord, ObservedRequest, SmokeReport, SmokeStep } from '../../shared/api.ts'
import type { HostContext } from '../context.ts'
import { deliverToSession } from '../sessions/delivery.ts'
import { ensureRouterSession, ROUTER_SESSION_TITLE, type RouterSession } from '../sessions/router.ts'
import { createWorkerSession, WORKER_WORKSPACE_TITLE } from '../sessions/worker.ts'
import { ensureDirectory } from '../state/directory.ts'
import { createTicketId, shortTicketId } from '../tickets/ids.ts'

const MAX_BEACONS = 200
const MAX_REQUESTS = 40

/** 投递给冒烟执行会话的简报：一句话确认，不调用工具，避免冒烟把工单做起来。 */
const SMOKE_BRIEF = [
  '这是一次通道冒烟投递，不是一个真实任务。',
  '请只用一句中文回答「通道已打通」，不要调用任何工具，也不要读写文件。',
].join('\n')

export interface SmokeState {
  beacons: BeaconRecord[]
  requests: ObservedRequest[]
  lastReport?: SmokeReport
}

export interface SmokeSuite {
  beacon(event: string, detail?: unknown): void
  recordRequest(entry: ObservedRequest): void
  state(): SmokeState
  runP0(): Promise<SmokeReport>
}

export function createSmokeSuite(ctx: HostContext, stateDirectory: string): SmokeSuite {
  const beacons: BeaconRecord[] = []
  const requests: ObservedRequest[] = []
  let lastReport: SmokeReport | undefined
  // 路由会话重复建会在左栏堆出多个置顶会话，进程内只建一次。
  let router: Promise<RouterSession> | undefined

  return {
    beacon(event, detail) {
      beacons.push(detail === undefined ? { at: Date.now(), event } : { at: Date.now(), event, detail })
      if (beacons.length > MAX_BEACONS) beacons.splice(0, beacons.length - MAX_BEACONS)
    },
    recordRequest(entry) {
      requests.push(entry)
      if (requests.length > MAX_REQUESTS) requests.splice(0, requests.length - MAX_REQUESTS)
    },
    state() {
      const base = { beacons: [...beacons], requests: [...requests] }
      return lastReport === undefined ? base : { ...base, lastReport }
    },
    async runP0() {
      const startedAt = Date.now()
      const steps: SmokeStep[] = []
      router ??= ensureRouterSession(ctx, stateDirectory)
      await runStep(steps, 'state-directory', async () => {
        await ensureDirectory(join(stateDirectory, 'work'))
        return stateDirectory
      })
      await runStep(steps, 'router-session', async () => {
        const session = await router
        return { ...session, title: ROUTER_SESSION_TITLE }
      })
      const worker = await runStep(steps, 'worker-session', async () => {
        const ticketId = createTicketId()
        const session = await createWorkerSession(ctx, stateDirectory, { ticketId, title: '冒烟：通道验证' })
        return { ...session, ticketId, shortId: shortTicketId(ticketId) }
      })
      if (worker !== undefined) {
        await runStep(steps, 'worker-delivery', async () => {
          const outcome = await deliverToSession(ctx, worker.sessionId, {
            requestId: `p0-delivery:${worker.ticketId}`,
            text: SMOKE_BRIEF,
          })
          return { outcome }
        })
        await runStep(steps, 'worker-trace', async () => summarizeSession(ctx, worker.sessionId))
      }
      await runStep(steps, 'worker-workspace', async () => ({
        title: WORKER_WORKSPACE_TITLE,
        workspaces: ctx.workspaceRegistry.list().map(workspace => ({
          id: workspace.id,
          title: workspace.title,
          path: workspace.path,
          sessions: workspace.sessionIds.length,
        })),
      }))
      await runStep(steps, 'package-import-probe', () => probePackageImports())

      const report: SmokeReport = { ranAt: startedAt, takenMs: Date.now() - startedAt, steps }
      lastReport = report
      return report
    },
  }
}

/**
 * 记录一步，失败不中断后续步骤。
 *
 * 冒烟的价值是一次调用看到全部断裂点；把异常聚成报告而不是抛给调用方。
 */
async function runStep<T>(
  steps: SmokeStep[],
  name: string,
  run: () => Promise<T> | T,
): Promise<T | undefined> {
  try {
    const detail = await run()
    steps.push({ name, ok: true, detail })
    return detail
  } catch (error) {
    steps.push({ name, ok: false, error: error instanceof Error ? `${error.name}: ${error.message}` : String(error) })
    return undefined
  }
}

/**
 * 探测插件产物能否在宿主里解析 `@deepseek-ai/*` 的运行时模块。
 *
 * 这决定后续能否直接复用 DSH 的运行时工具函数；结果写进报告，不改变行为。
 */
async function probePackageImports(): Promise<Record<string, string>> {
  const result: Record<string, string> = {}
  for (const specifier of ['@deepseek-ai/dsh-llm', '@deepseek-ai/dsh-tools']) {
    try {
      const loaded: unknown = await import(specifier)
      result[specifier] = `ok: ${Object.keys(loaded as object).length} exports`
    } catch (error) {
      result[specifier] = `failed: ${error instanceof Error ? error.message : String(error)}`
    }
  }
  return result
}

/**
 * 读一条会话的持久化事件，压缩成可读摘要。
 *
 * 会话日志落盘是压缩的追加帧，直接读文件只能看到第一帧；这里走持久化服务的
 * 读句柄，顺带验证「插件能不能复核会话里到底发生了什么」——审批送达的自愈检查
 * 就依赖这条路径。
 */
async function summarizeSession(ctx: HostContext, sessionId: SessionId): Promise<unknown> {
  await ctx.sessionPersistence.flush()
  const handle = await ctx.sessionPersistence.open(sessionId, 'read')
  try {
    const events: { type: string; data: unknown }[] = []
    for (let offset = 0; ; ) {
      const page = await handle.read(offset, 256)
      if (page.events.length === 0) break
      for (const event of page.events) events.push(event as { type: string; data: unknown })
      offset += page.events.length
    }
    const title = events.find(event => event.type === 'session/title')?.data
    const userMessages = events
      .filter(event => event.type === 'user/message')
      .map(event => {
        const data = event.data as { id?: string; source?: { kind?: string } }
        return { id: data.id, kind: data.source?.kind }
      })
    return {
      events: events.length,
      types: [...new Set(events.map(event => event.type))],
      title,
      userMessages,
      workingDirectories: events.filter(event => event.type === 'working-directory/change').length,
      assistantMessages: events.filter(event => event.type === 'assistant/message').length,
    }
  } finally {
    await handle[Symbol.asyncDispose]()
  }
}

/** 阻塞工具：任何 `timeoutMs` 都不声明，因此不受工具超时策略裁剪。 */
export function registerSmokeTool(ctx: HostContext): void {
  ctx.effect(
    () =>
      ctx.tools.register({
        name: 'pa_smoke_block',
        description:
          '开发期冒烟专用：保持阻塞指定毫秒数后返回。用于确认长阻塞的工具调用不会被超时策略裁剪。不要在真实任务里调用。',
        parameters: {
          type: 'object',
          additionalProperties: false,
          required: ['ms'],
          properties: {
            ms: { type: 'integer', minimum: 100, maximum: 600000, description: '阻塞毫秒数' },
          },
        },
        output: {
          schema: {
            type: 'object',
            additionalProperties: false,
            required: ['sleptMs', 'finishedAt'],
            properties: {
              sleptMs: { type: 'integer' },
              finishedAt: { type: 'number' },
            },
          },
          render: (_args: unknown, value: unknown) => {
            const slept = (value as { sleptMs?: number } | undefined)?.sleptMs
            return [{ type: 'text', text: `阻塞 ${slept ?? '?'} ms 后返回` }]
          },
        },
        execute: async (args, exec) => {
          const { ms } = args as { ms: number }
          await sleepWithSignal(ms, exec.signal)
          return { sleptMs: ms, finishedAt: Date.now() }
        },
      }),
    'personal-agent: smoke block tool',
  )
}

function sleepWithSignal(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new Error('aborted before blocking'))
      return
    }
    const onAbort = (): void => {
      clearTimeout(timer)
      reject(new Error('aborted during blocking'))
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    signal.addEventListener('abort', onAbort, { once: true })
  })
}
