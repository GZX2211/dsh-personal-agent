// src/host/sessions/decorate.ts
//
// agent/created 上的角色装饰（方案 §7.3）：按会话身份给 router / worker 装配
// 提示词 section、专属工具与工具裁剪。注册走 agent.ctx，agent 销毁时自动卸载；
// 插件卸载时也保留一份 disposer，两层所有权都成立。

import type { Agent } from '@deepseek-ai/dsh-agent'
import type { ResolverRegistry } from '../approvals/resolvers.ts'
import type { HostContext } from '../context.ts'
import type { Scheduler } from '../dispatcher/scheduler.ts'
import { loadPrompt } from '../prompts/index.ts'
import { roleForSession, type SessionRole } from '../roles/index.ts'
import type { ClaimRegistry } from '../signals/claim.ts'
import type { EventStore } from '../store/event-store.ts'
import { createApprovalSubmitTool } from '../tools/pa_approval_submit/index.ts'
import { createLedgerQueryTool } from '../tools/pa_ledger_query/index.ts'
import { createTaskRouteTool } from '../tools/pa_task_route/index.ts'

// 判定与服务同源（roles/）；保留原导出路径，既有调用点与测试不需要跟着改。
export { roleForSession, type SessionRole }

/** 角色提示词的 section 位置：第一方 section 在 0~10000 之间稀疏分配，900 不冲突。 */
const ROLE_SECTION_ORDER = 900

/**
 * router 不该自己动手：命令、文件写入与面向人的 UI 工具都裁掉。
 * 只裁剪「当前可见」的名字——restrict 遇到未知名字会抛错，而工具清单随部署变化。
 */
const ROUTER_DENY = ['pwsh', 'bash', 'write', 'edit', 'apply_patch', 'present', 'ask_user_question'] as const

/** worker 必须通过审批工具找人类，不能用会卡在自己会话里的提问或 UI 工具。 */
const WORKER_DENY = ['ask_user_question', 'present', 'plugin_manager'] as const

export interface AgentDecoratorOptions {
  ctx: HostContext
  store: EventStore
  scheduler: Scheduler
  resolvers: ResolverRegistry
  claims: ClaimRegistry
  maxWorkers: number
  /** router 身份是异步确定的，装饰时再读。 */
  currentRouterSessionId: () => string | undefined
  log?: (message: string) => void
}

export interface AgentDecorator {
  /** 显式装饰一个已存在的 agent（启动时 router 会话可能早于监听器就绪）。 */
  decorate(agent: Agent): void
  dispose(): void
}

/**
 * 插件重载后，已经在运行的 worker agent 不会再发 `agent/created`，
 * 上一实例的装饰也已随插件卸载释放。按账本里的 worker 绑定，给活着的 agent 补装饰。
 *
 * 只读 `ctx.agents.list()`，不会为了让会话可装饰而唤醒冷会话；冷会话将来被唤醒时
 * 会重新发 `agent/created`，那时账本绑定已存在，监听器即可完成装饰。
 */
export function decorateLiveWorkerSessions(options: {
  ctx: HostContext
  store: EventStore
  decorator: AgentDecorator
  log?: (message: string) => void
}): number {
  const workerSessionIds = new Set<string>()
  for (const ticket of options.store.projection().tickets) {
    if (ticket.workerSessionId !== undefined) workerSessionIds.add(ticket.workerSessionId)
  }
  if (workerSessionIds.size === 0) return 0

  let decorated = 0
  for (const agent of options.ctx.agents.list()) {
    if (!workerSessionIds.has(agent.session.id)) continue
    try {
      options.decorator.decorate(agent)
      decorated += 1
    } catch (error) {
      options.log?.(`failed to decorate live worker ${agent.session.id}: ${describe(error)}`)
    }
  }
  return decorated
}

export function createAgentDecorator(options: AgentDecoratorOptions): AgentDecorator {
  const decorated = new Map<string, () => void>()

  function decorate(agent: Agent): void {
    if (decorated.has(agent.id)) return
    const role = roleForSession(agent.session.id, options.currentRouterSessionId(), options.store.projection())
    if (role === undefined) return

    const dispose = agent.ctx.effect(() => {
      // 子注册的 disposer 由这个 effect 一并释放，agent 销毁即全部卸载。
      const cleanups: (() => void)[] = []
      cleanups.push(
        agent.ctx.systemPrompt.section({
          name: `personal-agent/${role}`,
          order: ROLE_SECTION_ORDER,
          text: `${loadPrompt('shared')}\n\n${loadPrompt(role)}`,
        }),
      )
      for (const definition of roleTools(role, options)) cleanups.push(agent.ctx.tools.register(definition))
      const deny = restrictableNames(agent, role === 'router' ? ROUTER_DENY : WORKER_DENY)
      if (deny.length > 0) cleanups.push(agent.ctx.tools.restrict({ deny }))
      return () => {
        for (const cleanup of cleanups.reverse()) cleanup()
      }
    }, `personal-agent: ${role} decoration`)

    decorated.set(agent.id, dispose)
  }

  function forget(agentId: string): void {
    const dispose = decorated.get(agentId)
    if (dispose === undefined) return
    decorated.delete(agentId)
    try {
      dispose()
    } catch (error) {
      options.log?.(`failed to release decoration for ${agentId}: ${describe(error)}`)
    }
  }

  const disposers = [
    options.ctx.on('agent/created', payload => {
      try {
        decorate(payload.agent)
      } catch (error) {
        options.log?.(`failed to decorate agent ${payload.agent.id}: ${describe(error)}`)
      }
    }),
    options.ctx.on('agent/disposed', payload => {
      forget(payload.agent.id)
    }),
  ]

  return {
    decorate,
    dispose() {
      for (const agentId of [...decorated.keys()]) forget(agentId)
      for (const dispose of disposers.reverse()) dispose()
    },
  }
}

function roleTools(role: SessionRole, options: AgentDecoratorOptions) {
  if (role === 'router') {
    return [
      createTaskRouteTool({
        ctx: options.ctx,
        store: options.store,
        scheduler: options.scheduler,
        claims: options.claims,
        maxWorkers: options.maxWorkers,
      }),
      createLedgerQueryTool({ store: options.store }),
    ]
  }
  return [createApprovalSubmitTool({ ctx: options.ctx, store: options.store, resolvers: options.resolvers })]
}

/** 只保留 agent 当前确实可见的工具名，避免 restrict 因未知名字失败。 */
function restrictableNames(agent: Agent, candidates: readonly string[]): string[] {
  const visible = new Set(agent.ctx.tools.definitions(agent).map(definition => definition.name))
  return candidates.filter(name => visible.has(name))
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
