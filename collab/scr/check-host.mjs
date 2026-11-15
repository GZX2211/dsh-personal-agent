// collab/scr/check-host.mjs
//
// 本地校验 lib/index.js：apply 装配、HTTP 分派、同源守卫、账本重放与 /snapshot。
// 用伪 ctx 跑，不碰真实 profile；状态目录指向临时目录。

import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const plugin = await import(new URL('../../lib/index.js', import.meta.url))

const stateDir = await mkdtemp(join(tmpdir(), 'pa-p1-'))
const routes = []
const tools = []
const sessions = new Map()
const pinned = []
const workspaces = []
const log = []

const ORIGIN = 'http://127.0.0.1:52810'
const TICKET_ID = 't-abc1234567'
const BASE_TIME = Date.UTC(2026, 10, 15)

// 先铺一份账本再加载插件：这一条路同时验证「重放 → 投影 → HTTP」。
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
    payload: { ticketId: TICKET_ID, workerSessionId: 'session-worker-1', mode: 'dispatch' },
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
      requestedBySessionId: 'session-worker-1',
    },
  },
]
await writeFile(join(stateDir, 'events.jsonl'), seed.map(event => `${JSON.stringify(event)}\n`).join(''), 'utf8')

function makeWorkspace(path, title) {
  const existing = workspaces.find(item => item.path === path)
  if (existing) return existing
  const workspace = { id: `w-${workspaces.length + 1}`, path, title, sessionIds: [] }
  workspaces.push(workspace)
  return workspace
}

const ctx = {
  logger: { warn: (...args) => log.push(['warn', ...args]) },
  effect: (fn, label) => {
    const dispose = fn()
    log.push(['effect', label])
    return () => dispose?.()
  },
  webServer: {
    getOrigin: () => ORIGIN,
    register: route => {
      routes.push(route)
      return () => {}
    },
  },
  workspaceRegistry: {
    create: async (path, title) => makeWorkspace(path, title),
    pinSession: async sessionId => {
      pinned.push(sessionId)
    },
    list: () => workspaces,
  },
  sessionController: {
    list: async () => ({ items: [...sessions.keys()].map(sessionId => ({ sessionId })) }),
    create: async () => {
      const sessionId = `s-${sessions.size + 1}`
      sessions.set(sessionId, { title: undefined })
      return { sessionId }
    },
    rename: async request => {
      const session = sessions.get(request.sessionId)
      if (session) session.title = request.title
      return { title: request.title, seq: 1 }
    },
    resolveAgent: async () => ({ error: { code: 'session-not-live' } }),
  },
  workingDirectory: { set: async () => undefined },
  sessionPersistence: { flush: async () => undefined },
  tools: {
    register: definition => {
      tools.push(definition)
      return () => {}
    },
  },
}

function makeRequest({ method = 'GET', url, headers = {} }) {
  return {
    method,
    url,
    headers: Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value])),
    async *[Symbol.asyncIterator]() {},
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
  plugin.apply(ctx, { stateDir })
  check(
    'apply registers one prefix route',
    routes.length === 1 && routes[0].path === '/personal-agent/api' && routes[0].kind === 'prefix',
    routes[0]?.path,
  )
  check('P1 registers no agent tools yet', tools.length === 0, tools.map(tool => tool.name))

  await new Promise(resolve => setTimeout(resolve, 80))
  check(
    'router session created + renamed + pinned',
    sessions.size === 1 && [...sessions.values()][0].title === '个人代理 · 路由' && pinned.length === 1,
    { pinned, sessions: [...sessions.entries()] },
  )

  const route = routes[0]
  const health = await call(route, { url: '/personal-agent/api/health' })
  check('GET /health is 200 without any header', health.status === 200 && health.json?.ok === true, health.json)
  check('health reports the state dir', health.json?.stateDir === stateDir, health.json?.stateDir)

  const guarded = await call(route, { url: '/personal-agent/api/snapshot' })
  check(
    'GET /snapshot rejects a header-less request',
    guarded.status === 403 && guarded.json?.code === 'missing-request-header',
    guarded.json,
  )

  const wrongOrigin = await call(route, {
    url: '/personal-agent/api/snapshot',
    headers: { 'x-personal-agent-request': '1', origin: 'http://evil.example' },
  })
  check(
    'GET /snapshot rejects a foreign origin',
    wrongOrigin.status === 403 && wrongOrigin.json?.code === 'wrong-origin',
    wrongOrigin.json,
  )

  const snapshot = await call(route, {
    url: '/personal-agent/api/snapshot',
    headers: { 'x-personal-agent-request': '1', referer: `${ORIGIN}/session/x` },
  })
  check('GET /snapshot accepts a same-origin referer', snapshot.status === 200, snapshot.json)
  const ticket = snapshot.json?.tickets?.[0]
  check(
    'snapshot replays the ledger into a blocked ticket',
    ticket?.stage === 'blocked' && ticket?.shortId === 'abc123' && ticket?.workerSessionId === 'session-worker-1',
    ticket,
  )
  check(
    'snapshot exposes the pending approval',
    snapshot.json?.approvals?.length === 1 && snapshot.json?.approvals?.[0]?.id === 'a-1',
    snapshot.json?.approvals,
  )
  check(
    'snapshot stats count stages and approvals',
    snapshot.json?.stats?.tickets?.blocked === 1 &&
      snapshot.json?.stats?.tickets?.total === 1 &&
      snapshot.json?.stats?.approvals?.pending === 1,
    snapshot.json?.stats,
  )

  const method = await call(route, {
    method: 'POST',
    url: '/personal-agent/api/snapshot',
    headers: { 'x-personal-agent-request': '1', origin: ORIGIN },
  })
  check('POST /snapshot is 405 with allow GET', method.status === 405 && method.headers?.allow === 'GET', method.json)

  const retired = await call(route, {
    url: '/personal-agent/api/dev/p0',
    headers: { 'x-personal-agent-request': '1', origin: ORIGIN },
  })
  check('P0 dev routes are gone', retired.status === 404 && retired.json?.code === 'not-found', retired.json)
} finally {
  await rm(stateDir, { recursive: true, force: true })
  console.log(`\n${ok.length} passed, ${fail.length} failed`)
  if (fail.length > 0) process.exitCode = 1
}
