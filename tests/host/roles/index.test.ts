// tests/host/roles/index.test.ts
//
// 角色服务的对外契约：账本与 router 身份就绪前一律未知；就绪后按会话身份
// 给出 router / worker，其余会话保持未知。判定规则本身由 decorate 的测试覆盖。

import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import type { Projection } from '../../../src/host/projector/project.ts'
import { PaRolesService } from '../../../src/host/roles/index.ts'

const ROUTER = 'session-router'
const WORKER = 'session-worker'

function projectionWith(workerSessionId: string | undefined): Pick<Projection, 'tickets'> {
  const tickets = workerSessionId === undefined ? [] : [{ workerSessionId }]
  return { tickets } as unknown as Pick<Projection, 'tickets'>
}

function serviceWith(workerSessionId: string | undefined, routerSessionId: string | undefined) {
  const service = new PaRolesService(new Context())
  service.attach({ projection: () => projectionWith(workerSessionId) as unknown as Projection })
  service.setRouterSessionId(routerSessionId)
  return service
}

describe('PaRolesService', () => {
  it('账本未接入时对任何会话都返回未知', () => {
    const service = new PaRolesService(new Context())

    expect(service.roleOf(ROUTER)).toBeUndefined()
    expect(service.roleOf(WORKER)).toBeUndefined()
  })

  it('账本接入后仍未确定 router 身份时，router 会话保持未知', () => {
    const service = serviceWith(undefined, undefined)

    expect(service.roleOf(ROUTER)).toBeUndefined()
  })

  it('router 身份确定后判定为 router', () => {
    const service = serviceWith(undefined, ROUTER)

    expect(service.roleOf(ROUTER)).toBe('router')
  })

  it('账本里有工单绑定的会话判定为 worker', () => {
    const service = serviceWith(WORKER, ROUTER)

    expect(service.roleOf(WORKER)).toBe('worker')
  })

  it('既不是 router 也没有工单绑定的会话保持未知', () => {
    const service = serviceWith(WORKER, ROUTER)

    expect(service.roleOf('session-other')).toBeUndefined()
  })

  it('router 身份被清空后回到未知，不残留旧角色', () => {
    const service = serviceWith(undefined, ROUTER)
    expect(service.roleOf(ROUTER)).toBe('router')

    service.setRouterSessionId(undefined)

    expect(service.roleOf(ROUTER)).toBeUndefined()
  })
})
