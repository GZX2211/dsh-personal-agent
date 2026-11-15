// tests/support/fake-host.ts
//
// 伪宿主：只实现插件真正用到的服务面，但行为是真实的（会话表、投递记录、
// agent 状态、归档集合）。它让调度、观察、审批这些协作逻辑可以在无进程的情况下
// 被测试，同时不 Mock 插件自己的模块。

import type { HostContext } from '../../src/host/context.ts'

export interface FakeDelivered {
  requestId: string
  text: string
}

export interface FakeAgent {
  id: string
  session: { id: string }
  status: 'idle' | 'running'
  inbox: { nextTurn: unknown[]; nextStep: unknown[] }
  followup(message: { id: string; content: { type: string; text?: string }[] }): void
}

export interface FakeSession {
  sessionId: string
  title?: string
  cwd?: string
  delivered: FakeDelivered[]
  agent: FakeAgent
}

export interface FakeHost {
  ctx: HostContext
  sessions: Map<string, FakeSession>
  workspaces: { id: string; path: string; title: string; sessionIds: string[] }[]
  pinned: string[]
  effects: string[]
  tools: { name: string }[]
  sections: { name: string; order: number; text: string }[]
  restrictions: unknown[]
  warnings: string[]
  archivedSessionIds: string[]
  createCalls: number
  /** 让下一次会话创建抛错，用于验证失败路径。 */
  failNextCreate(message: string): void
  createdSessionIds(): string[]
}

export interface FakeHostOptions {
  /** 预先存在的会话（迁移/复用路径）。 */
  liveSessionIds?: string[]
  /** 归档集合，供审批作废分支判断。 */
  archivedSessionIds?: string[]
  /** 每次投递时回调，便于在「投递发生的那一刻」检查账本状态。 */
  onFollowup?: (sessionId: string, requestId: string) => void
}

export function createFakeHost(options: FakeHostOptions = {}): FakeHost {
  const sessions = new Map<string, FakeSession>()
  const workspaces: FakeHost['workspaces'] = []
  const pinned: string[] = []
  const effects: string[] = []
  const tools: { name: string }[] = []
  const sections: FakeHost['sections'] = []
  const restrictions: unknown[] = []
  const warnings: string[] = []
  const archivedSessionIds = [...(options.archivedSessionIds ?? [])]
  let createCalls = 0
  let createFailure: string | undefined
  const created: string[] = []

  function addSession(sessionId: string): FakeSession {
    const session: FakeSession = {
      sessionId,
      delivered: [],
      agent: {
        id: sessionId,
        session: { id: sessionId },
        status: 'idle',
        inbox: { nextTurn: [], nextStep: [] },
        followup(message) {
          session.delivered.push({
            requestId: message.id,
            text: message.content.map(block => block.text ?? '').join(''),
          })
          this.inbox.nextTurn.push(message)
          options.onFollowup?.(sessionId, message.id)
        },
      },
    }
    sessions.set(sessionId, session)
    return session
  }

  for (const sessionId of options.liveSessionIds ?? []) addSession(sessionId)

  const ctx = {
    logger: {
      warn: (format: string, ...args: unknown[]) => {
        warnings.push([format, ...args].map(value => String(value)).join(' '))
      },
    },
    effect: (fn: () => (() => void) | void, label: string) => {
      const dispose = fn()
      effects.push(label)
      return () => dispose?.()
    },
    on: () => () => {},
    webServer: {
      getOrigin: () => 'http://127.0.0.1:52810',
      register: () => () => {},
    },
    workspaceRegistry: {
      create: async (path: string, title: string) => {
        const existing = workspaces.find(workspace => workspace.path === path)
        if (existing !== undefined) return existing
        const workspace = { id: `w-${workspaces.length + 1}`, path, title, sessionIds: [] }
        workspaces.push(workspace)
        return workspace
      },
      pinSession: async (sessionId: string) => {
        pinned.push(sessionId)
      },
      list: () => workspaces,
      get archivedSessionIds() {
        return archivedSessionIds
      },
    },
    sessionController: {
      list: async () => ({ items: [...sessions.keys()].map(sessionId => ({ sessionId })) }),
      create: async () => {
        createCalls += 1
        if (createFailure !== undefined) {
          const message = createFailure
          createFailure = undefined
          throw new Error(message)
        }
        const sessionId = `session-${createCalls}`
        addSession(sessionId)
        created.push(sessionId)
        return { sessionId }
      },
      rename: async (request: { sessionId: string; title: string }) => {
        const session = sessions.get(request.sessionId)
        if (session !== undefined) session.title = request.title
        return { title: request.title, seq: 1 }
      },
      resolveAgent: async (sessionId: string) => {
        const session = sessions.get(sessionId)
        return session === undefined
          ? { error: { code: 'session/not-found' } }
          : { agent: session.agent }
      },
    },
    workingDirectory: {
      set: async (agent: { id: string }, path: string) => {
        const session = sessions.get(agent.id)
        if (session !== undefined) session.cwd = path
        return path
      },
    },
    sessionPersistence: { flush: async () => undefined },
    tools: {
      register: (definition: { name: string }) => {
        tools.push(definition)
        return () => {}
      },
      restrict: (filter: unknown) => {
        restrictions.push(filter)
        return () => {}
      },
      definitions: () => tools,
    },
    systemPrompt: {
      section: (section: { name: string; order: number; text: string }) => {
        sections.push(section)
        return () => {}
      },
    },
  }

  return {
    ctx: ctx as unknown as HostContext,
    sessions,
    workspaces,
    pinned,
    effects,
    tools,
    sections,
    restrictions,
    warnings,
    archivedSessionIds,
    get createCalls() {
      return createCalls
    },
    failNextCreate(message: string) {
      createFailure = message
    },
    createdSessionIds: () => [...created],
  }
}
