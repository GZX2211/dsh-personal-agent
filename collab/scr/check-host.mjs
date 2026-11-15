// collab/scr/check-host.mjs
//
// 本地校验 lib/index.js：apply 装配、HTTP 分派、同源守卫、账本重放、角色装饰与
// 审批决定端点。用伪 ctx 跑，不碰真实 profile；状态目录指向临时目录。

import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const plugin = await import(new URL('../../lib/index.js', import.meta.url))

const stateDir = await mkdtemp(join(tmpdir(), 'pa-p2-'))

const ORIGIN = 'http://127.0.0.1:52810'
const TICKET_ID = 't-abc1234567'
const WORKER_SESSION = 'session-worker-1'
const BASE_TIME = Date.UTC(2026, 10, 15)

// 先铺一份账本再加载插件：同时验证「重放 → 投影 → HTTP」与角色判定。
function seedEventId(n) {
  return n.toString(16).padStart(32, '0')
}

const seed = [
  {
    seq: 1,
    eventId: seedEventId(1),
    type: 'task/queued',
    time: BASE_TIME + 1,
    actor: 'router',
    correlationId: TICKET_ID,
    payload: {
      ticketId: TICKET_ID,
      title: '发布 v2',
      goal: '把 v2 发出去',
      mode: 'dispatch',
      queueReason: 'capacity-full',
    },
  },
  {
    seq: 2,
    eventId: seedEventId(2),
    type: 'task/dispatched',
    time: BASE_TIME + 2,
    actor: 'system',
    correlationId: TICKET_ID,
    payload: { ticketId: TICKET_ID, workerSessionId: WORKER_SESSION, mode: 'dispatch' },
  },
  {
    seq: 3,
    eventId: seedEventId(3),
    type: 'approval/pending',
    time: BASE_TIME + 3,
    actor: 'worker',
    correlationId: TICKET_ID,
    payload: {
      approvalId: 'a-1',
      ticketId: TICKET_ID,
      title: '要发布吗',
      question: '发布到生产会立刻影响用户。',
      options: [{ label: '发布', description: '立刻上线' }],
      requestedBySessionId: WORKER_SESSION,
    },
  },
]
await writeFile(join(stateDir, 'events.jsonl'), seed.map(event => `${JSON.stringify(event)}\n`).join(''), 'utf8')

function makeAgent(sessionId) {
  const agent = {
    id: sessionId,
    session: { id: sessionId },
    status: 'idle',
    inbox: { nextTurn: [], nextStep: [] },
    delivered: [],
    toolNames: [],
    toolImpls: new Map(),
    sections: [],
    restrictions: [],
    disposed: false,
    ctx: {
      effect(fn) {
        const dispose = fn()
        return () => {
          dispose?.()
          agent.disposed = true
        }
      },
      tools: {
        register: definition => {
          agent.toolNames.push(definition.name)
          agent.toolImpls.set(definition.name, definition)
          return () => {}
        },
        restrict: filter => {
          agent.restrictions.push(filter)
          return () => {}
        },
        definitions: () => [],
      },
      systemPrompt: {
        section: section => {
          agent.sections.push(section)
          return () => {}
        },
      },
    },
    followup: message => {
      agent.delivered.push(message)
    },
  }
  return agent
}

function makeHost() {
  const sessions = new Map()
  const routes = []
  const listeners = new Map()
  const workspaces = []
  const pinned = []
  const globalTools = []
  const effects = []
  const warnings = []
  let created = 0

  function addSession(sessionId) {
    const session = { sessionId, title: undefined, agent: makeAgent(sessionId), events: [] }
    sessions.set(sessionId, session)
    return session
  }
  addSession(WORKER_SESSION)

  const ctx = {
    logger: { warn: (...args) => warnings.push(args.map(String).join(' ')) },
    effect: (fn, label) => {
      const dispose = fn()
      effects.push(label)
      return () => dispose?.()
    },
    on: (name, listener) => {
      const list = listeners.get(name) ?? []
      list.push(listener)
      listeners.set(name, list)
      return () => {
        const index = list.indexOf(listener)
        if (index >= 0) list.splice(index, 1)
      }
    },
    webServer: {
      getOrigin: () => ORIGIN,
      register: route => {
        routes.push(route)
        return () => {}
      },
    },
    workspaceRegistry: {
      create: async (path, title) => {
        const existing = workspaces.find(item => item.path === path)
        if (existing) return existing
        const workspace = { id: `w-${workspaces.length + 1}`, path, title, sessionIds: [] }
        workspaces.push(workspace)
        return workspace
      },
      pinSession: async sessionId => {
        pinned.push(sessionId)
      },
      list: () => workspaces,
      archivedSessionIds: [],
    },
    sessionController: {
      list: async () => ({ items: [...sessions.keys()].map(sessionId => ({ sessionId })) }),
      create: async () => {
        created += 1
        const sessionId = `session-${created}`
        const session = addSession(sessionId)
        // 真实宿主在 create 返回前就发布 agent/created；此时账本里还没有工单绑定。
        emit('agent/created', { agent: session.agent, source: 'fresh' })
        return { sessionId }
      },
      rename: async request => {
        const session = sessions.get(request.sessionId)
        if (session) session.title = request.title
        return { title: request.title, seq: 1 }
      },
      resolveAgent: async sessionId => {
        const session = sessions.get(sessionId)
        return session ? { agent: session.agent } : { error: { code: 'session/not-found' } }
      },
    },
    workingDirectory: {
      set: async (agent, path) => {
        const session = sessions.get(agent.id)
        if (session) session.cwd = path
        return path
      },
    },
    agents: {
      list: () => [...sessions.values()].map(session => session.agent),
      get: sessionId => sessions.get(sessionId)?.agent,
    },
    sessionPersistence: {
      flush: async () => undefined,
      open: async sessionId => {
        const session = sessions.get(sessionId)
        if (!session) throw new Error(`no session ${sessionId}`)
        return {
          read: async offset => ({ events: offset === 0 ? [...session.events] : [] }),
          [Symbol.asyncDispose]: async () => undefined,
        }
      },
    },
    tools: {
      register: definition => {
        globalTools.push(definition)
        return () => {}
      },
      restrict: () => () => {},
      definitions: () => globalTools,
    },
    systemPrompt: {
      section: () => () => {},
    },
  }

  function emit(name, payload) {
    for (const listener of listeners.get(name) ?? []) listener(payload)
  }

  return { ctx, sessions, routes, pinned, globalTools, warnings, emit }
}

function makeRequest({ method = 'GET', url, headers = {}, body }) {
  const encoded = body === undefined ? undefined : Buffer.from(JSON.stringify(body), 'utf8')
  return {
    method,
    url,
    headers: Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value])),
    async *[Symbol.asyncIterator]() {
      if (encoded !== undefined) yield encoded
    },
  }
}

function makeResponse() {
  const captured = { status: 0, headers: {}, body: '' }
  return {
    captured,
    setHeader: (name, value) => {
      captured.headers[name.toLowerCase()] = value
    },
    writeHead: (status, headers) => {
      captured.status = status
      Object.assign(captured.headers, headers)
    },
    end: body => {
      captured.body = body === undefined ? '' : String(body)
    },
  }
}

async function call(route, options) {
  const response = makeResponse()
  await route.handler(makeRequest(options), response)
  return { ...response.captured, json: safeJson(response.captured.body) }
}

function safeJson(text) {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

const ok = []
const fail = []
function check(name, condition, detail) {
  ;(condition ? ok : fail).push(name)
  console.log(
    `${condition ? 'PASS' : 'FAIL'} ${name}${detail === undefined ? '' : ` :: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`}`,
  )
}

try {
  const host = makeHost()
  plugin.apply(host.ctx, { stateDir, maxWorkers: 2 })
  await new Promise(resolve => setTimeout(resolve, 150))

  check(
    'apply registers one prefix route',
    host.routes.length === 1 && host.routes[0].path === '/personal-agent/api' && host.routes[0].kind === 'prefix',
    host.routes[0]?.path,
  )
  check('P2 registers no global tools (all are agent-scoped)', host.globalTools.length === 0)

  const routerSessionId = host.pinned[0]
  const routerAgent = routerSessionId === undefined ? undefined : host.sessions.get(routerSessionId)?.agent
  check(
    'router session created + renamed + pinned',
    routerAgent !== undefined && host.pinned.length === 1,
    { pinned: host.pinned, sessions: [...host.sessions.keys()] },
  )
  check(
    'router agent is decorated with dispatch + ledger query',
    routerAgent?.toolNames.join(',') === 'pa_task_route,pa_ledger_query',
    routerAgent?.toolNames,
  )
  check(
    'router prompt section is installed',
    (routerAgent?.sections[0]?.text ?? '').includes('pa_task_route'),
    routerAgent?.sections.length,
  )

  host.emit('agent/created', { agent: host.sessions.get(WORKER_SESSION)?.agent, source: 'resume' })
  const workerAgent = host.sessions.get(WORKER_SESSION)?.agent
  check(
    'worker agent is decorated with the approval tool',
    workerAgent?.toolNames.join(',') === 'pa_approval_submit',
    workerAgent?.toolNames,
  )
  check(
    'worker prompt section tells it to wait through the approval tool',
    (workerAgent?.sections[0]?.text ?? '').includes('pa_approval_submit'),
    workerAgent?.sections.length,
  )

  const route = host.routes[0]
  if (route === undefined) throw new Error('console api route was not registered')

  const health = await call(route, { url: '/personal-agent/api/health' })
  check('GET /health is 200 without any header', health.status === 200 && health.json?.ok === true, health.json)

  const guarded = await call(route, { url: '/personal-agent/api/snapshot' })
  check(
    'GET /snapshot rejects a header-less request',
    guarded.status === 403 && guarded.json?.code === 'missing-request-header',
    guarded.json,
  )

  const sameOrigin = { 'x-personal-agent-request': '1', origin: ORIGIN }
  const fetchSiteSnapshot = await call(route, {
    url: '/personal-agent/api/snapshot',
    headers: { 'x-personal-agent-request': '1', 'sec-fetch-site': 'same-origin' },
  })
  check(
    'GET /snapshot accepts a same-origin Sec-Fetch-Site without Referer',
    fetchSiteSnapshot.status === 200 && fetchSiteSnapshot.json?.tickets?.length === 1,
    fetchSiteSnapshot.json?.tickets?.length,
  )

  // 桌面端（dsh-app://app）转发时删除 Origin/Referer/Sec-Fetch-Site，只留下自定义头。
  const desktopForwarded = await call(route, {
    url: '/personal-agent/api/snapshot',
    headers: { 'x-personal-agent-request': '1' },
  })
  check(
    'GET /snapshot accepts the desktop-forwarded request without browser evidence',
    desktopForwarded.status === 200 && desktopForwarded.json?.tickets?.length === 1,
    desktopForwarded.status,
  )

  const desktopReferer = await call(route, {
    url: '/personal-agent/api/snapshot',
    headers: { 'x-personal-agent-request': '1', referer: 'dsh-app://app/' },
  })
  check(
    'GET /snapshot accepts the desktop application page referer',
    desktopReferer.status === 200,
    desktopReferer.status,
  )

  const snapshot = await call(route, { url: '/personal-agent/api/snapshot', headers: sameOrigin })
  check(
    'snapshot replays the ledger into a blocked ticket',
    snapshot.status === 200 &&
      snapshot.json?.tickets?.[0]?.stage === 'blocked' &&
      snapshot.json?.tickets?.[0]?.shortId === 'abc123',
    snapshot.json?.tickets?.[0],
  )

  const unknownDecision = await call(route, {
    method: 'POST',
    url: '/personal-agent/api/approvals/a-ghost/decide',
    headers: sameOrigin,
    body: { kind: 'skipped' },
  })
  check(
    'POST decide returns not-found for an unknown approval',
    unknownDecision.status === 404 && unknownDecision.json?.code === 'not-found',
    unknownDecision.json,
  )

  const wrongMethod = await call(route, { url: '/personal-agent/api/approvals/a-1/decide', headers: sameOrigin })
  check(
    'GET decide is 405 with allow POST',
    wrongMethod.status === 405 && wrongMethod.headers?.allow === 'POST',
    wrongMethod.json,
  )

  const invalidDecision = await call(route, {
    method: 'POST',
    url: '/personal-agent/api/approvals/a-1/decide',
    headers: sameOrigin,
    body: { kind: 'selected', index: 9 },
  })
  check(
    'POST decide rejects an out-of-range option',
    invalidDecision.status === 400 && invalidDecision.json?.code === 'invalid-decision',
    invalidDecision.json,
  )

  const decided = await call(route, {
    method: 'POST',
    url: '/personal-agent/api/approvals/a-1/decide',
    headers: sameOrigin,
    body: { kind: 'selected', index: 0 },
  })
  check(
    'POST decide falls back to followup when the tool is not blocked',
    decided.status === 200 && decided.json?.ok === true && decided.json?.transport === 'followup',
    decided.json,
  )
  const deliveredText = workerAgent?.delivered?.[0]?.content?.[0]?.text ?? ''
  check(
    'the decision message is delivered to the worker',
    deliveredText.includes('[审批结果]') && deliveredText.includes('决定：发布（option 0）'),
    deliveredText.split('\n')[0],
  )
  const afterDecision = await call(route, { url: '/personal-agent/api/snapshot', headers: sameOrigin })
  check(
    'the approval moves to decided and the ticket leaves blocked',
    afterDecision.json?.approvals?.[0]?.decision?.transport === 'followup' &&
      afterDecision.json?.tickets?.[0]?.stage === 'running',
    { approval: afterDecision.json?.approvals?.[0], ticket: afterDecision.json?.tickets?.[0] },
  )

  const retired = await call(route, { url: '/personal-agent/api/dev/p0', headers: sameOrigin })
  check('P0 dev routes are gone', retired.status === 404 && retired.json?.code === 'not-found', retired.json)

  // 复现真实时序：worker agent 在 task/dispatched 之前发布，放行后必须补装饰。
  const routeTool = routerAgent?.toolImpls?.get('pa_task_route')
  if (routeTool === undefined) throw new Error('router tool pa_task_route was not registered')
  const routed = await routeTool.execute(
    { action: 'dispatch', title: '验收：需要审批', goal: '需要审批的任务' },
    {
      signal: new AbortController().signal,
      agent: routerAgent,
      callId: 'call-1',
      rootCallId: 'call-1',
      name: 'pa_task_route',
      arguments: {},
      token: Symbol('call'),
    },
  )
  const dispatchedWorker = host.sessions.get(routed.sessionId)
  check(
    'pa_task_route dispatches a worker session',
    routed.status === 'running' && dispatchedWorker !== undefined,
    routed,
  )
  check(
    'new worker is decorated before the brief is delivered',
    dispatchedWorker?.agent.toolNames.join(',') === 'pa_approval_submit' &&
      dispatchedWorker?.agent.sections.length === 1,
    { tools: dispatchedWorker?.agent.toolNames, sections: dispatchedWorker?.agent.sections.length },
  )
  check(
    'the brief reaches the decorated worker',
    (dispatchedWorker?.agent.delivered[0]?.content?.[0]?.text ?? '').includes('目标：需要审批的任务'),
    dispatchedWorker?.agent.delivered.length,
  )
} finally {
  await rm(stateDir, { recursive: true, force: true })
  console.log(`\n${ok.length} passed, ${fail.length} failed`)
  if (fail.length > 0) process.exitCode = 1
}
