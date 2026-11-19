// src/host/roles/index.ts
//
// 角色判定与对外只读服务：外部插件需要知道某个会话是 router 还是 worker，
// 才能在对应角色上施加能力限制。判定规则只此一份，装饰器与对外服务共用，
// 避免两处判定随版本漂移。

import { Service } from '@deepseek-ai/cordis'
import type { Context } from '@deepseek-ai/cordis'
import type { Projection } from '../projector/project.ts'
import type { EventStore } from '../store/event-store.ts'

export type SessionRole = 'router' | 'worker'

/**
 * 从会话身份判断角色；worker 以「账本里有工单绑定该会话」为准。
 *
 * 不是 PA 域的会话返回 undefined——调用方必须把这个结果当作「未知」处理，
 * 不能默认成某个角色，否则黑名单会误伤普通会话。
 */
export function roleForSession(
  sessionId: string,
  routerSessionId: string | undefined,
  projection: Pick<Projection, 'tickets'>,
): SessionRole | undefined {
  if (routerSessionId !== undefined && sessionId === routerSessionId) return 'router'
  return projection.tickets.some(ticket => ticket.workerSessionId === sessionId) ? 'worker' : undefined
}

/** 对外只读契约：按会话身份查询角色，不暴露任何写入口。 */
export interface PersonalAgentRoles {
  roleOf(sessionId: string): SessionRole | undefined
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    paRoles: PaRolesService
  }
}

/**
 * 角色查询服务。
 *
 * 账本与 router 身份都是异步就绪的，所以先注册服务、后就绪装配：就绪前
 * `roleOf` 一律返回 undefined，调用方据此走「未知角色」分支，而不是拿到
 * 一个错误的角色。重复 attach 以最后一次为准，重启恢复时会重新赋值。
 */
export class PaRolesService extends Service implements PersonalAgentRoles {
  private store: Pick<EventStore, 'projection'> | undefined
  private routerSessionId: string | undefined

  constructor(ctx: Context) {
    super(ctx, 'paRoles')
  }

  /** 账本打开后接入。 */
  attach(store: Pick<EventStore, 'projection'>): void {
    this.store = store
  }

  /** 路由会话身份确定后接入。 */
  setRouterSessionId(sessionId: string | undefined): void {
    this.routerSessionId = sessionId
  }

  roleOf(sessionId: string): SessionRole | undefined {
    const store = this.store
    if (store === undefined) return undefined
    return roleForSession(sessionId, this.routerSessionId, store.projection())
  }
}
