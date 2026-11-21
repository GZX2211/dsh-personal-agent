// tests/support/fake-host.ts
//
// 伪宿主：只实现插件真正用到的服务面，但行为是真实的（会话表、投递记录、
// agent 状态、归档集合）。它让调度、观察、审批这些协作逻辑可以在无进程的情况下
// 被测试，同时不 Mock 插件自己的模块。

import type { HostContext } from '../../src/host/context.ts'

export interface FakeDelivered {
  requestId: string
  text: string
  /** `true` 表示这条消息走的是 steer（插入当前回合的下一步）。 */
  steered?: boolean
  /** 原始消息，便于断言 source 与内容块。 */
  message?: { id: string; source?: unknown }
}

export interface FakeSection {
  name: string
  order: number
  /** 真实宿主接受静态文本或装配时求值的函数；替身原样保存。 */
  text: string | ((context: unknown) => string)
}

/** 求值一个 section 的文本；动态 section 才算得出装配时的真实内容。 */
export function sectionText(section: FakeSection): string {
  return typeof section.text === 'function' ? section.text({}) : section.text
}

export interface FakeSessionLog {
  id: string
  /** 通过 `append` 写入的事件，便于断言模型选择等副作用。 */
  appended: { type: string; data: unknown }[]
  /** 已记录的请求头；非空表示会话已经发过请求。 */
  header?: unknown
  /** 模拟路由报告的模型标称窗口；未设置时 `requestContext()` 返回 undefined。 */
  requestWindow?: number
  requestHeader(): unknown
  requestContext(): { provider: string; model: string; contextWindow?: number } | undefined
  snapshotEvents(): { type: string; time?: number; data?: unknown }[]
  append(type: string, data: unknown): void
}

export interface FakeAgent {
  id: string
  session: FakeSessionLog
  status: 'idle' | 'running'
  inbox: { nextTurn: unknown[]; nextStep: unknown[] }
  /** 该 agent 作用域内注册的工具名。 */
  toolNames: string[]
  /** 该 agent 作用域内注册的工具定义（按名字）。 */
  toolImpls: Map<string, unknown>
  /** 该 agent 作用域内的提示词 section。 */
  sections: FakeSection[]
  /** 该 agent 的 restrict 调用。 */
  restrictions: unknown[]
  /** agent 作用域 effect 的标签与释放状态。 */
  effectLabels: string[]
  /** agent 作用域监听器（`agent/request` 等），测试可直接取用。 */
  listeners: Map<string, ((...args: unknown[]) => unknown)[]>
  disposed: boolean
  ctx: {
    effect(fn: () => (() => void) | void, label: string): () => void
    on(name: string, listener: (...args: unknown[]) => unknown, options?: unknown): () => void
    tools: {
      register(definition: { name: string }): () => void
      restrict(filter: unknown): () => void
      definitions(scope?: unknown): { name: string }[]
    }
    systemPrompt: {
      section(section: FakeSection): () => void
    }
  }
  followup(message: { id: string; content: { type: string; text?: string }[] }): void
  steer(message: { id: string; content: { type: string; text?: string }[] }): void
}

export interface FakeSession {
  sessionId: string
  title?: string
  cwd?: string
  delivered: FakeDelivered[]
  events: unknown[]
  agent: FakeAgent
}

export interface FakeHost {
  ctx: HostContext
  sessions: Map<string, FakeSession>
  workspaces: { id: string; path: string; title: string; sessionIds: string[] }[]
  pinned: string[]
  effects: string[]
  tools: { name: string }[]
  sections: FakeSection[]
  restrictions: unknown[]
  warnings: string[]
  archivedSessionIds: string[]
  createCalls: number
  /** 让下一次会话创建抛错，用于验证失败路径。 */
  failNextCreate(message: string): void
  /** 让下一次投递抛错，用于验证「放行事实已写入、投递失败」。 */
  failNextFollowup(message: string): void
  /** 让下一次 steer 抛错，用于验证补充的失败路径。 */
  failNextSteer(message: string): void
  /** 设置某个会话已到达的回合号，供工具读取「当前回合」。 */
  setTurn(sessionId: string, turn: number): void
  /** 模拟一条会话事件：先记进伪会话日志，再分发给 session/event 监听者。 */
  emitSessionEvent(sessionId: string, event: unknown): void
  /** 新增一个活会话，模拟 Agent 晚于工单就绪。 */
  addSession(sessionId: string): FakeSession
  /** 分发任意 Cordis 事件（agent/created 等）。 */
  emitEvent(name: string, ...args: unknown[]): void
  createdSessionIds(): string[]
}

export interface FakeHostOptions {
  /** 预先存在的会话（迁移/复用路径）。 */
  liveSessionIds?: string[]
  /** 归档集合，供审批作废分支判断。 */
  archivedSessionIds?: string[]
  /** 每次投递时回调，便于在「投递发生的那一刻」检查账本状态。 */
  onFollowup?: (sessionId: string, requestId: string) => void
  /** 全局可见工具名：角色装饰的 restrict 只会裁剪这里的名字。 */
  visibleTools?: string[]
  /** `sessionController.create` 是否像真实宿主一样，在返回前发布 agent/created。 */
  emitAgentCreatedOnCreate?: boolean
  /** 投递时是否像真实宿主一样发出 inbox splice 事件（观察者据此记账）。 */
  emitSpliceOnDelivery?: boolean
  /** 按服务名注入的可选宿主服务（如 skills），`ctx.get(name)` 读取它们。 */
  services?: Record<string, unknown>
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
  const sessionTurns = new Map<string, number>()
  let createCalls = 0
  let createFailure: string | undefined
  let followupFailure: string | undefined
  let steerFailure: string | undefined
  const created: string[] = []

  function addSession(sessionId: string): FakeSession {
    const session: FakeSession = {
      sessionId,
      delivered: [],
      events: [],
      agent: undefined as unknown as FakeAgent,
    }
    const log: FakeSessionLog = {
      id: sessionId,
      appended: [],
      requestHeader: () => log.header,
      requestContext: () =>
        log.requestWindow === undefined
          ? undefined
          : { provider: 'fake', model: 'fake-model', contextWindow: log.requestWindow },
      snapshotEvents: () => session.events as { type: string; time?: number; data?: unknown }[],
      append(type, data) {
        log.appended.push({ type, data })
        const event = { type, seq: session.events.length + 1, time: Date.now(), data }
        session.events.push(event)
        // 与真实会话一致：append 提交后分发 session/event。
        emit('session/event', log, event)
      },
    }
    const agentListeners = new Map<string, ((...args: unknown[]) => unknown)[]>()
    const agent: FakeAgent = {
      id: sessionId,
      session: log,
      status: 'idle',
      inbox: { nextTurn: [], nextStep: [] },
      toolNames: [],
      toolImpls: new Map<string, unknown>(),
      sections: [],
      restrictions: [],
      effectLabels: [],
      listeners: agentListeners,
      disposed: false,
      ctx: {
        effect(fn, label) {
          const dispose = fn()
          agent.effectLabels.push(label)
          return () => {
            dispose?.()
            agent.disposed = true
          }
        },
        on(name, listener) {
          const list = agentListeners.get(name) ?? []
          list.push(listener)
          agentListeners.set(name, list)
          return () => {
            const index = list.indexOf(listener)
            if (index >= 0) list.splice(index, 1)
          }
        },
        tools: {
          register(definition) {
            agent.toolNames.push(definition.name)
            agent.toolImpls.set(definition.name, definition)
            return () => undefined
          },
          restrict(filter) {
            agent.restrictions.push(filter)
            return () => undefined
          },
          definitions: () => (options.visibleTools ?? []).map(name => ({ name })),
        },
        systemPrompt: {
          section(section) {
            agent.sections.push(section)
            return () => undefined
          },
        },
      },
      followup(message) {
        if (followupFailure !== undefined) {
          const failure = followupFailure
          followupFailure = undefined
          throw new Error(failure)
        }
        deliverToInbox(agent, message, false)
      },
      steer(message) {
        if (steerFailure !== undefined) {
          const failure = steerFailure
          steerFailure = undefined
          throw new Error(failure)
        }
        deliverToInbox(agent, message, true)
      },
    }
    session.agent = agent
    sessions.set(sessionId, session)
    return session
  }

  /** 记录一次投递；按需模拟真实宿主发出的 inbox splice（观察者据此记账）。 */
  function deliverToInbox(
    agent: FakeAgent,
    message: { id: string; content: { type: string; text?: string }[] },
    steered: boolean,
  ): void {
    const session = sessions.get(agent.session.id)
    if (session === undefined) throw new Error(`fake host has no session ${agent.session.id}`)
    session.delivered.push({
      requestId: message.id,
      text: message.content.map(block => block.text ?? '').join(''),
      ...(steered ? { steered: true } : {}),
      message: { id: message.id, source: (message as { source?: unknown }).source },
    })
    if (steered) agent.inbox.nextStep.push(message)
    else agent.inbox.nextTurn.push(message)
    options.onFollowup?.(session.sessionId, message.id)

    if (options.emitSpliceOnDelivery !== true) return
    const event = {
      type: 'agent/inbox/spliced',
      seq: session.events.length + 1,
      time: Date.now(),
      data: {
        target: steered ? 'next-step' : 'next-turn',
        start: 0,
        inserted: [message],
      },
    }
    session.events.push(event)
    emit('session/event', session.agent.session, event)
  }

  for (const sessionId of options.liveSessionIds ?? []) addSession(sessionId)

  const listeners = new Map<string, ((...args: never[]) => unknown)[]>()

  function emit(name: string, ...args: unknown[]): void {
    for (const listener of listeners.get(name) ?? []) {
      ;(listener as unknown as (...values: unknown[]) => unknown)(...args)
    }
  }

  const ctx = {
    logger: {
      warn: (format: string, ...args: unknown[]) => {
        warnings.push([format, ...args].map(value => String(value)).join(' '))
      },
    },
    /** 可选宿主服务：没注入的返回 undefined，与真实宿主的可选依赖一致。 */
    get: (name: string) => (options.services ?? {})[name],
    effect: (fn: () => (() => void) | void, label: string) => {
      const dispose = fn()
      effects.push(label)
      return () => dispose?.()
    },
    on: (name: string, listener: (...args: never[]) => unknown) => {
      const list = listeners.get(name) ?? []
      list.push(listener)
      listeners.set(name, list)
      return () => {
        const index = list.indexOf(listener)
        if (index >= 0) list.splice(index, 1)
      }
    },
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
        const session = addSession(sessionId)
        created.push(sessionId)
        if (options.emitAgentCreatedOnCreate === true) {
          emit('agent/created', { agent: session.agent, source: 'fresh' })
        }
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
      get: (session: { id: string }) => {
        const cwd = sessions.get(session.id)?.cwd
        if (cwd === undefined) throw new Error(`fake session ${session.id} has no working directory`)
        return cwd
      },
      set: async (agent: { id: string }, path: string) => {
        const session = sessions.get(agent.id)
        if (session !== undefined) session.cwd = path
        return path
      },
    },
    sessionPersistence: {
      flush: async () => undefined,
      open: async (sessionId: string) => {
        const session = sessions.get(sessionId)
        if (session === undefined) throw new Error(`fake persistence has no session ${sessionId}`)
        return {
          read: async (offset: number) => ({
            events: offset === 0 ? [...session.events] : [],
          }),
          [Symbol.asyncDispose]: async () => undefined,
        }
      },
    },
    agents: {
      list: () => [...sessions.values()].map(session => session.agent),
      get: (sessionId: string) => sessions.get(sessionId)?.agent,
      // 只实现工具真正读到的 lastTurn；其余边界字段与本插件的判定无关。
      turnBoundaryOf: (session: { id: string }) => ({
        openTurnStartSeq: null,
        lastStepStartSeq: null,
        lastStepBoundary: null,
        lastTurn: sessionTurns.get(session.id) ?? 0,
      }),
    },
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
      section: (section: FakeSection) => {
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
    failNextFollowup(message: string) {
      followupFailure = message
    },
    failNextSteer(message: string) {
      steerFailure = message
    },
    setTurn(sessionId: string, turn: number) {
      sessionTurns.set(sessionId, turn)
    },
    emitSessionEvent(sessionId: string, event: unknown) {
      const session = sessions.get(sessionId)
      if (session === undefined) throw new Error(`fake host has no session ${sessionId}`)
      session.events.push(event)
      emit('session/event', session.agent.session, event)
    },
    addSession,
    emitEvent(name: string, ...args: unknown[]) {
      emit(name, ...args)
    },
    createdSessionIds: () => [...created],
  }
}
