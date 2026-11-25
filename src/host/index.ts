// src/host/index.ts
//
// 插件宿主入口：装配状态目录、账本与 kv、调度器、回合观察、角色装饰与同源 HTTP 面。
// 只做装配与协调，业务语义在各模块里。

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { SessionId } from '@deepseek-ai/dsh-session'
import { API_PREFIX, ERROR_CODES, type SnapshotResponse } from '../shared/api.ts'
import { healPendingApprovals } from './approvals/heal.ts'
import { ResolverRegistry } from './approvals/resolvers.ts'
import { createApprovalDecider } from './approvals/service.ts'
import { sourceFailure, settingsFailure, type FailureOutcome } from './console-api/errors.ts'
import { createConsoleHandler } from './console-api/server.ts'
import { createTicketDetailService } from './sessions/detail-service.ts'
import type { HostContext } from './context.ts'
import { createScheduler } from './dispatcher/scheduler.ts'
import { createPerceptionService, PerceptionError } from './perception/service.ts'
import { readTimerSourceViews } from './perception/timers.ts'
import { projectSignals } from './projector/project.ts'
import { querySignals as searchSignals } from './projector/signal-query.ts'
import { defaultPromptTexts } from './prompts/index.ts'
import { PaRolesService } from './roles/index.ts'
import { createRuntime } from './runtime/index.ts'
import { settingsErrorCode } from './settings/errors.ts'
import { hostModelCatalog } from './settings/model.ts'
import { createSettingsService } from './settings/service.ts'
import { SettingsStore } from './settings/store.ts'
import { createAgentDecorator, decorateLiveWorkerSessions } from './sessions/decorate.ts'
import { registerWorkerObserver } from './sessions/observer.ts'
import { ensureRouterSession } from './sessions/router.ts'
import { createClaimRegistry } from './signals/claim.ts'
import { registerRouterSignalObserver } from './signals/observer.ts'
import { registerPerceptionSkill } from './skills/perception.ts'
import { resolveStateDirectory } from './state/directory.ts'
import { EventStore } from './store/event-store.ts'
import { KvStore } from './store/kv-store.ts'

export const name = 'dsh-gzx-agent'

/** 需要的宿主服务：缺任何一个都不该沉默地半启动。 */
export const inject = [
  'webServer',
  'sessionController',
  'workspaceRegistry',
  'workingDirectory',
  'sessionPersistence',
  'tools',
  'systemPrompt',
  'agents',
]

/** 执行槽位默认值（方案 §5.3）。 */
const DEFAULT_MAX_WORKERS = 5

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

  // 只读角色服务：外部插件（能力管理等）靠它判定 router / worker。
  // PA 不反向依赖任何调用方；账本与 router 身份就绪前 roleOf 返回 undefined。
  const roles = new PaRolesService(ctx)

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

  // 设置同样是技术元数据：执行器配置与派单规则允许改写，提示词版本只追加。
  const settingsStore = SettingsStore.open({
    directory: stateDir,
    defaultMaxWorkers: maxWorkers,
    defaultPrompts: defaultPromptTexts(),
    onWarning: message => logWarning(ctx, message),
  })
  void settingsStore.catch((error: unknown) => logWarning(ctx, `settings unavailable: ${describe(error)}`))

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
  let disposeSignalObserver: (() => void) | undefined
  let disposeDecorator: (() => void) | undefined
  let stopPerception: (() => void) | undefined
  let stopRuntime: (() => void) | undefined
  let prepareWorker: ((sessionId: SessionId) => Promise<void>) | undefined

  // 账本、kv 与设置就绪后装配有状态的服务：调度器、回合观察、角色装饰、感知来源。
  const ready = Promise.all([ledger, identities, settingsStore]).then(([store, kv, settings]) => {
    roles.attach(store)
    const settingsService = createSettingsService({
      store: settings,
      stateDirectory: stateDir,
      modelCatalog: () => hostModelCatalog(ctx),
    })
    // 概览的运行时读模型：账本就绪后 replay 一次，之后只增量观察。
    const runtime = createRuntime({ ctx, store, log: message => logWarning(ctx, message) })
    stopRuntime = runtime.close
    // 信号配对是进程内状态：账本只记信号与决定，配对关系重启即丢。
    const claims = createClaimRegistry()
    // 来源的渠道在 router 会话就绪之后才启动（投递需要目标会话）。
    const perception = createPerceptionService({
      ctx,
      store,
      kv,
      stateDirectory: stateDir,
      currentRouterSessionId: () => routerSessionId as SessionId | undefined,
      log: message => logWarning(ctx, message),
    })
    stopPerception = perception.stop
    const scheduler = createScheduler({
      ctx,
      store,
      stateDirectory: stateDir,
      maxWorkers: () => settingsService.maxWorkers(),
      executorRoot: () => settingsService.executorRoot(),
      workerModel: () => settingsService.workerModel(),
      onWorkerReady: async sessionId => {
        await prepareWorker?.(sessionId)
      },
      log: message => logWarning(ctx, message),
    })
    const decorator = createAgentDecorator({
      ctx,
      store,
      scheduler,
      resolvers,
      claims,
      perception,
      settings: settingsService,
      maxWorkers: () => settingsService.maxWorkers(),
      currentRouterSessionId: () => routerSessionId,
      log: message => logWarning(ctx, message),
    })
    disposeDecorator = decorator.dispose
    // 详情页要读会话日志，读一次比一条快照贵：单独一层按签名失效的缓存。
    const detailService = createTicketDetailService({
      ctx,
      store,
      log: message => logWarning(ctx, message),
    })
    disposeObserver = registerWorkerObserver({
      ctx,
      store,
      scheduler,
      log: message => logWarning(ctx, message),
    })
    disposeSignalObserver = registerRouterSignalObserver({
      ctx,
      store,
      claims,
      currentRouterSessionId: () => routerSessionId,
      log: message => logWarning(ctx, message),
    })
    // 放行后补装饰：worker agent 在 task/dispatched 之前就已创建，创建钩子认不出它。
    prepareWorker = async sessionId => {
      try {
        const resolved = await ctx.sessionController.resolveAgent(sessionId)
        if ('agent' in resolved) decorator.decorate(resolved.agent)
      } catch (error) {
        logWarning(ctx, `worker decoration failed for ${sessionId}: ${describe(error)}`)
      }
    }
    return { store, kv, scheduler, decorator, perception, settingsService, runtime, detail: detailService }
  })
  void ready.catch((error: unknown) => logWarning(ctx, `services unavailable: ${describe(error)}`))

  ctx.effect(() => {
    const disposeSkill = registerPerceptionSkill(ctx, message => logWarning(ctx, message))
    const disposeRoute = ctx.webServer.register({
      kind: 'prefix',
      path: API_PREFIX,
      handler: createConsoleHandler({
        plugin: name,
        version: readPackageVersion(),
        origin,
        stateDir,
        startedAt,
        snapshot: async () => {
          const { store, perception, runtime, settingsService } = await ready
          const projection = store.projection()
          const now = Date.now()
          const timers = await readTimerSourceViews(
            ctx.get('schedule'),
            routerSessionId,
            projection.sourceTallies,
            message => logWarning(ctx, message),
          )
          const response: SnapshotResponse = {
            tickets: projection.tickets,
            approvals: projection.approvals,
            signals: projection.signals,
            sources: perception.sources(),
            timers,
            stats: projection.stats,
            workers: runtime.workers(projection),
            capacity: { maxWorkers: settingsService.maxWorkers() },
            activity: runtime.activity(now),
            ...(routerSessionId === undefined ? {} : { routerSessionId }),
          }
          return response
        },
        decideApproval: async (approvalId, request) => (await decider).decide(approvalId, request),
        toggleSource: async (sourceId, request) => {
          const { perception } = await ready
          try {
            const source = await perception.toggle(sourceId, request.enabled, request.threadId)
            return { status: 200, body: { ok: true, source } }
          } catch (error) {
            return failureOf(error)
          }
        },
        testSource: async (sourceId, request) => {
          const { perception } = await ready
          try {
            const signals = await perception.test(sourceId, request.waitMs)
            return { status: 200, body: { ok: true, signals } }
          } catch (error) {
            return failureOf(error)
          }
        },
        removeSource: async sourceId => {
          const { perception } = await ready
          try {
            const removed = await perception.remove(sourceId)
            return { status: 200, body: { ok: true, removed } }
          } catch (error) {
            return failureOf(error)
          }
        },
        querySignals: async query => {
          const { store } = await ready
          return searchSignals(projectSignals(store.events()), query)
        },
        getSettings: async () => (await ready).settingsService.view(),
        saveExecutor: async body => {
          try {
            const { settingsService } = await ready
            return { status: 200, body: await settingsService.saveExecutor(body) }
          } catch (error) {
            return settingsFailure(settingsErrorCode(error), describe(error))
          }
        },
        savePolicy: async body => {
          try {
            const { settingsService } = await ready
            return { status: 200, body: await settingsService.savePolicy(body) }
          } catch (error) {
            return settingsFailure(settingsErrorCode(error), describe(error))
          }
        },
        savePrompts: async body => {
          try {
            const { settingsService } = await ready
            return { status: 200, body: await settingsService.savePrompts(body) }
          } catch (error) {
            return settingsFailure(settingsErrorCode(error), describe(error))
          }
        },
        getPromptRevision: async revision => {
          try {
            const { settingsService } = await ready
            return { status: 200, body: settingsService.promptVersion(revision) }
          } catch (error) {
            return settingsFailure(settingsErrorCode(error), describe(error))
          }
        },
        ticketDetail: async ticketId => {
          const { detail } = await ready
          return detail.detail(ticketId)
        },
      }),
    })
    return () => {
      disposeRoute()
      disposeSkill()
      disposeObserver?.()
      disposeSignalObserver?.()
      disposeDecorator?.()
      stopPerception?.()
      stopRuntime?.()
      void ledger.then(store => store.close()).catch(() => undefined)
      void identities.then(store => store.close()).catch(() => undefined)
      void settingsStore.then(store => store.close()).catch(() => undefined)
    }
  }, 'personal-agent: console api')

  // 启动收尾：恢复/创建路由会话 → 装饰 router 与活着的 worker → 启动感知来源 → 消化队列。
  void ready
    .then(async ({ store, kv, scheduler, decorator, perception }) => {
      const session = await ensureRouterSession(ctx, stateDir, kv)
      routerSessionId = session.sessionId
      roles.setRouterSessionId(session.sessionId)
      const resolved = await ctx.sessionController.resolveAgent(session.sessionId)
      if ('agent' in resolved) decorator.decorate(resolved.agent)
      // 重载后活着的 worker 不再发 agent/created，按账本绑定补装饰。
      decorateLiveWorkerSessions({ ctx, store, decorator, log: message => logWarning(ctx, message) })
      // 来源用同一个 router 会话投递，必须等身份确定之后再启动。
      await perception.start()
      await scheduler.trigger('startup')
    })
    .catch((error: unknown) => {
      logWarning(ctx, `router session unavailable: ${describe(error)}`)
    })
}

export function resolveMaxWorkers(value: number | undefined): number {
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

/** 把服务层异常换成协议失败体：感知错误保留自己的稳定码，其余按 internal。 */
function failureOf(error: unknown): FailureOutcome {
  if (error instanceof PerceptionError) return sourceFailure(error.code, error.message)
  return sourceFailure(ERROR_CODES.internal, describe(error))
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
