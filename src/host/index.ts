// src/host/index.ts
//
// 插件宿主入口：装配状态目录、账本与 kv、调度器、回合观察、角色装饰与同源 HTTP 面。
// 只做装配与协调，业务语义在各模块里。

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { API_PREFIX } from '../shared/api.ts'
import { healPendingApprovals } from './approvals/heal.ts'
import { ResolverRegistry } from './approvals/resolvers.ts'
import { createApprovalDecider } from './approvals/service.ts'
import { createConsoleHandler } from './console-api/server.ts'
import type { HostContext } from './context.ts'
import { createScheduler } from './dispatcher/scheduler.ts'
import { createAgentDecorator } from './sessions/decorate.ts'
import { registerWorkerObserver } from './sessions/observer.ts'
import { ensureRouterSession } from './sessions/router.ts'
import { resolveStateDirectory } from './state/directory.ts'
import { EventStore } from './store/event-store.ts'
import { KvStore } from './store/kv-store.ts'

export const name = 'dsh-personal-agent'

/** 需要的宿主服务：缺任何一个都不该沉默地半启动。 */
export const inject = [
  'webServer',
  'sessionController',
  'workspaceRegistry',
  'workingDirectory',
  'sessionPersistence',
  'tools',
  'systemPrompt',
]

/** 执行槽位默认值（方案 §5.3）。 */
export const DEFAULT_MAX_WORKERS = 5

export interface Config {
  /** 状态目录覆盖；缺省 `<DSH_HOME>/state/personal-agent`。 */
  stateDir?: string
  /** 同时进行的工单上限；缺省 5。 */
  maxWorkers?: number
}

export function apply(ctx: HostContext, config?: Config): void {
  const startedAt = Date.now()
  const stateDir = resolveStateDirectory(config?.stateDir)
  const maxWorkers = resolveMaxWorkers(config?.maxWorkers)
  const origin = ctx.webServer.getOrigin()

  // 账本要先读盘重放，因此打开是异步的；路由先挂上，请求等待它就绪。
  // 打不开也不能让插件整个起不来：健康检查与路由仍要可用，错误由快照端点暴露。
  const ledger = EventStore.open({
    directory: stateDir,
    onWarning: message => logWarning(ctx, message),
  })
  void ledger.catch((error: unknown) => logWarning(ctx, `ledger unavailable: ${describe(error)}`))

  // 技术元数据（router 身份）与业务账本分开：它允许改写，损坏只降级不阻断。
  const identities = KvStore.open({
    directory: stateDir,
    onWarning: message => logWarning(ctx, message),
  })
  void identities.catch((error: unknown) => logWarning(ctx, `kv unavailable: ${describe(error)}`))

  const resolvers = new ResolverRegistry()
  const decider = ledger.then(store => createApprovalDecider({ ctx, store, resolvers }))

  // 启动自愈：补写「已送达但未记账」的审批；失败只记日志。
  void ledger
    .then(store => healPendingApprovals({ ctx, store, log: message => logWarning(ctx, message) }))
    .then(count => {
      if (count > 0) logWarning(ctx, `recovered ${count} approval decision(s) from session logs`)
    })
    .catch((error: unknown) => logWarning(ctx, `approval self-heal failed: ${describe(error)}`))

  let routerSessionId: string | undefined
  let disposeObserver: (() => void) | undefined
  let disposeDecorator: (() => void) | undefined

  // 账本与 kv 就绪后装配有状态的服务：调度器、回合观察、角色装饰。
  const ready = Promise.all([ledger, identities]).then(([store, kv]) => {
    const scheduler = createScheduler({ ctx, store, stateDirectory: stateDir, maxWorkers, log: message => logWarning(ctx, message) })
    const decorator = createAgentDecorator({
      ctx,
      store,
      scheduler,
      resolvers,
      maxWorkers,
      currentRouterSessionId: () => routerSessionId,
      log: message => logWarning(ctx, message),
    })
    disposeDecorator = decorator.dispose
    disposeObserver = registerWorkerObserver({
      ctx,
      store,
      scheduler,
      log: message => logWarning(ctx, message),
    })
    return { store, kv, scheduler, decorator }
  })
  void ready.catch((error: unknown) => logWarning(ctx, `services unavailable: ${describe(error)}`))

  ctx.effect(() => {
    const disposeRoute = ctx.webServer.register({
      kind: 'prefix',
      path: API_PREFIX,
      handler: createConsoleHandler({
        plugin: name,
        version: readPackageVersion(),
        origin,
        stateDir,
        startedAt,
        snapshot: async () => (await ledger).projection(),
        decideApproval: async (approvalId, request) => (await decider).decide(approvalId, request),
      }),
    })
    return () => {
      disposeRoute()
      disposeObserver?.()
      disposeDecorator?.()
      void ledger.then(store => store.close()).catch(() => undefined)
      void identities.then(store => store.close()).catch(() => undefined)
    }
  }, 'personal-agent: console api')

  // 启动收尾：恢复/创建路由会话 → 装饰 router agent → 消化重启前遗留的队列。
  void ready
    .then(async ({ kv, scheduler, decorator }) => {
      const session = await ensureRouterSession(ctx, stateDir, kv)
      routerSessionId = session.sessionId
      const resolved = await ctx.sessionController.resolveAgent(session.sessionId)
      if ('agent' in resolved) decorator.decorate(resolved.agent)
      await scheduler.trigger('startup')
    })
    .catch((error: unknown) => {
      logWarning(ctx, `router session unavailable: ${describe(error)}`)
    })
}

function resolveMaxWorkers(value: number | undefined): number {
  if (value === undefined) return DEFAULT_MAX_WORKERS
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`personal-agent: maxWorkers must be a positive integer, got ${String(value)}`)
  }
  return value
}

/** 版本号的真身是 package.json；读不到也不能让插件起不来。 */
function readPackageVersion(): string {
  try {
    const manifest = JSON.parse(readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8')) as {
      version?: unknown
    }
    return typeof manifest.version === 'string' ? manifest.version : 'unknown'
  } catch {
    return 'unknown'
  }
}

function logWarning(ctx: HostContext, message: string): void {
  ctx.logger?.warn('personal-agent: %s', message)
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
