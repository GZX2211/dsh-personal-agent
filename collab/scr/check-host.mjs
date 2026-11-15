// collab/scr/check-host.mjs
//
// 本地校验 lib/index.js：apply 装配、HTTP 分派、同源守卫、P0 冒烟全链路。
// 用伪 ctx 跑，不碰真实 profile；状态目录指向临时目录。

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const plugin = await import(new URL('../../lib/index.js', import.meta.url))

const stateDir = await mkdtemp(join(tmpdir(), 'pa-p0-'))
const routes = []
const tools = []
const sessions = new Map()
const pinned = []
const workspaces = []
const log = []

const ORIGIN = 'http://127.0.0.1:52810'

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
    resolveAgent: async sessionId => ({
      agent: {
        id: sessionId,
        inbox: { nextTurn: [], nextStep: [] },
        followup: message => log.push(['followup', sessionId, message.id, message.content[0].text.split('\n')[0]]),
      },
    }),
  },
  workingDirectory: {
    set: async (agent, path) => {
      log.push(['cwd', agent.id, path])
      return path
    },
  },
  sessionPersistence: {
    flush: async () => log.push(['flush']),
    open: async sessionId => {
      const events = [
        { type: 'session/title', data: { title: `fake ${sessionId}` } },
        { type: 'user/message', data: { id: 'pa-delivery:x', source: { kind: 'dsh-personal-agent' } } },
        { type: 'assistant/message', data: { content: [] } },
      ]
      return {
        read: async offset => ({ events: offset === 0 ? events : [] }),
        [Symbol.asyncDispose]: async () => {},
      }
    },
  },
  tools: { register: definition => { tools.push(definition); return () => {} } },
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
  console.log(`${condition ? 'PASS' : 'FAIL'} ${name}${detail === undefined ? '' : ` :: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`}`)
}

try {
  plugin.apply(ctx, { stateDir })
  check('apply registers one prefix route', routes.length === 1 && routes[0].path === '/personal-agent/api' && routes[0].kind === 'prefix', routes[0]?.path)
  check('apply registers the blocking tool', tools.some(tool => tool.name === 'pa_smoke_block'), tools.map(tool => tool.name))
  await new Promise(resolve => setTimeout(resolve, 50))
  check('router session created + renamed + pinned', sessions.size === 1 && [...sessions.values()][0].title === '个人代理 · 路由' && pinned.length === 1, { pinned, sessions: [...sessions.entries()] })

  const route = routes[0]
  const health = await call(route, { url: '/personal-agent/api/health' })
  check('GET /health is 200 without any header', health.status === 200 && health.json?.ok === true, health.json)
  check('health reports the state dir', health.json?.stateDir === stateDir, health.json?.stateDir)

  const guarded = await call(route, { url: '/personal-agent/api/dev/state' })
  check('guarded route rejects a header-less request', guarded.status === 403 && guarded.json?.code === 'missing-request-header', guarded.json)

  const wrongOrigin = await call(route, {
    url: '/personal-agent/api/dev/state',
    headers: { 'x-personal-agent-request': '1', origin: 'http://evil.example' },
  })
  check('guarded route rejects a foreign origin', wrongOrigin.status === 403 && wrongOrigin.json?.code === 'wrong-origin', wrongOrigin.json)

  const state = await call(route, {
    url: '/personal-agent/api/dev/state',
    headers: { 'x-personal-agent-request': '1', referer: `${ORIGIN}/session/x` },
  })
  check('guarded route accepts a same-origin referer', state.status === 200 && Array.isArray(state.json?.beacons), state.json)

  const beacon = await call(route, {
    method: 'POST',
    url: '/personal-agent/api/dev/beacon',
    headers: { 'x-personal-agent-request': '1', origin: ORIGIN },
  })
  check('POST /dev/beacon needs a body event', beacon.status === 400, beacon.json)

  const p0 = await call(route, {
    method: 'POST',
    url: '/personal-agent/api/dev/p0',
    headers: { 'x-personal-agent-request': '1', origin: ORIGIN },
  })
  const failed = (p0.json?.steps ?? []).filter(step => !step.ok)
  check('POST /dev/p0 completes every step', p0.status === 200 && failed.length === 0, failed)
  const delivery = (p0.json?.steps ?? []).find(step => step.name === 'worker-delivery')
  check('P0 delivered a follow-up to the worker', delivery?.detail?.outcome === 'delivered', delivery)
  const workerStep = (p0.json?.steps ?? []).find(step => step.name === 'worker-session')
  const workerTitle = sessions.get(workerStep?.detail?.sessionId)?.title
  check(
    'worker title puts the task name first',
    /^冒烟：通道验证 · 工单 #[0-9a-f]{6}$/.test(workerTitle ?? ''),
    workerTitle,
  )
  check('follow-up used the plugin source kind', log.some(entry => entry[0] === 'followup'), log.filter(entry => entry[0] === 'followup'))

  const tool = tools.find(item => item.name === 'pa_smoke_block')
  const startedAt = Date.now()
  const value = await tool.execute({ ms: 200 }, { signal: new AbortController().signal })
  check('blocking tool resolves after the requested delay', value.sleptMs === 200 && Date.now() - startedAt >= 200, value)

  const aborted = new AbortController()
  const pending = tool.execute({ ms: 5000 }, { signal: aborted.signal })
  aborted.abort()
  const abortError = await pending.then(() => undefined, error => error)
  check('blocking tool honours cancellation', abortError instanceof Error, abortError?.message)
} finally {
  await rm(stateDir, { recursive: true, force: true })
  console.log(`\n${ok.length} passed, ${fail.length} failed`)
  if (fail.length > 0) process.exitCode = 1
}
