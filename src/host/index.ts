// src/host/index.ts
//
// 插件宿主入口：装配状态目录、账本、同源 HTTP 面与路由会话。
// 只做装配与协调，业务语义在各模块里。

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { API_PREFIX } from '../shared/api.ts'
import { createConsoleHandler } from './console-api/server.ts'
import type { HostContext } from './context.ts'
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
]

export interface Config {
  /** 状态目录覆盖；缺省 `<DSH_HOME>/state/personal-agent`。 */
  stateDir?: string
}

export function apply(ctx: HostContext, config?: Config): void {
  const startedAt = Date.now()
  const stateDir = resolveStateDirectory(config?.stateDir)
  const origin = ctx.webServer.getOrigin()

  // 账本要先读盘重放，因此打开是异步的；路由先挂上，快照请求等待它就绪。
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
      }),
    })
    return () => {
      disposeRoute()
      void ledger.then(store => store.close()).catch(() => undefined)
      void identities.then(store => store.close()).catch(() => undefined)
    }
  }, 'personal-agent: console api')

  // 路由会话是产品入口：左栏固定区里必须一直有它，不能等用户先点开面板。
  // 与会话本身无关的清理动作不存在，因此这里不用 ctx.effect 包裹。
  void identities
    .then(store => ensureRouterSession(ctx, stateDir, store))
    .catch((error: unknown) => {
      logWarning(ctx, `router session unavailable: ${describe(error)}`)
    })
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
