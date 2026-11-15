// src/host/index.ts
//
// 插件宿主入口：装配状态目录、同源 HTTP 面、路由会话与（P0 阶段）冒烟面。
// 只做装配与协调，业务语义在各模块里。

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { API_PREFIX } from '../shared/api.ts'
import { createConsoleHandler } from './console-api/server.ts'
import type { HostContext } from './context.ts'
import { createSmokeSuite, registerSmokeTool } from './dev/smoke.ts'
import { ensureRouterSession } from './sessions/router.ts'
import { resolveStateDirectory } from './state/directory.ts'

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
  const smoke = createSmokeSuite(ctx, stateDir)

  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: 'prefix',
        path: API_PREFIX,
        handler: createConsoleHandler({
          plugin: name,
          version: readPackageVersion(),
          origin,
          stateDir,
          startedAt,
          smoke,
        }),
      }),
    'personal-agent: console api',
  )

  registerSmokeTool(ctx)

  // 路由会话是产品入口：左栏固定区里必须一直有它，不能等用户先点开面板。
  // 与会话本身无关的清理动作不存在，因此这里不用 ctx.effect 包裹。
  void ensureRouterSession(ctx, stateDir).catch((error: unknown) => {
    logWarning(ctx, `router session unavailable: ${error instanceof Error ? error.message : String(error)}`)
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
