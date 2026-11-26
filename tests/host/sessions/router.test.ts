// tests/host/sessions/router.test.ts
//
// 路由会话身份是技术元数据：记录在账本 kv 里，重启后复用一个会话；
// P1 之前的 router-session.json 需要迁移而不是让用户多出一个置顶会话。

import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { HostContext } from '../../../src/host/context.ts'
import {
  ensureRouterSession,
  registerRouterArchiveRebind,
  releaseRouterIdentity,
  ROUTER_SESSION_TITLE,
} from '../../../src/host/sessions/router.ts'
import { KvStore } from '../../../src/host/store/kv-store.ts'

let directory: string
const opened: KvStore[] = []

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'pa-router-'))
})

afterEach(async () => {
  for (const store of opened.splice(0)) await store.close()
  await rm(directory, { recursive: true, force: true })
})

async function openKv(): Promise<KvStore> {
  const store = await KvStore.open({ directory })
  opened.push(store)
  return store
}

interface Harness {
  ctx: HostContext
  sessions: Map<string, { title?: string }>
  pinned: string[]
  createdCount: () => number
  archived: string[]
  archive: (sessionId: string) => void
  restore: (sessionId: string) => void
  emitArchived: (sessionId: string) => void
}

function harness(liveSessionIds: string[] = []): Harness {
  const sessions = new Map<string, { title?: string }>()
  for (const id of liveSessionIds) sessions.set(id, {})
  const pinned: string[] = []
  const archived: string[] = []
  const listeners = new Map<string, ((payload: { sessionId: string }) => void)[]>()
  const workspaces: { id: string; path: string; title: string; sessionIds: string[] }[] = []
  let created = 0
  const ctx = {
    workspaceRegistry: {
      create: async (path: string, title: string) => {
        const workspace = { id: `w-${workspaces.length + 1}`, path, title, sessionIds: [] }
        workspaces.push(workspace)
        return workspace
      },
      pinSession: async (sessionId: string) => {
        // 宿主对归档会话的 pin 会抛错；测试如实地模拟，避免只靠 list 判断漏掉它。
        if (archived.includes(sessionId)) throw new Error(`cannot pin archived session ${sessionId}`)
        pinned.push(sessionId)
      },
      get archivedSessionIds() {
        return archived
      },
    },
    sessionController: {
      // 归档会话仍留在列表里，这是引发死锁的真实行为。
      list: async () => ({ items: [...sessions.keys()].map(sessionId => ({ sessionId })) }),
      create: async () => {
        created += 1
        const sessionId = `session-${created}`
        sessions.set(sessionId, {})
        return { sessionId }
      },
      rename: async (request: { sessionId: string; title: string }) => {
        const session = sessions.get(request.sessionId)
        if (session !== undefined) session.title = request.title
        return { title: request.title, seq: 1 }
      },
    },
    on: (name: string, listener: (payload: { sessionId: string }) => void) => {
      const current = listeners.get(name) ?? []
      current.push(listener)
      listeners.set(name, current)
      return () => {
        listeners.set(name, (listeners.get(name) ?? []).filter(item => item !== listener))
      }
    },
  }
  return {
    ctx: ctx as unknown as HostContext,
    sessions,
    pinned,
    createdCount: () => created,
    archived,
    archive: (sessionId: string) => {
      if (!archived.includes(sessionId)) archived.push(sessionId)
    },
    restore: (sessionId: string) => {
      const index = archived.indexOf(sessionId)
      if (index >= 0) archived.splice(index, 1)
    },
    emitArchived: (sessionId: string) => {
      for (const listener of listeners.get('workspace/session-archived') ?? []) listener({ sessionId })
    },
  }
}

function legacyPath(): string {
  return join(directory, 'router-session.json')
}

describe('ensureRouterSession', () => {
  it('creates one router session, pins it and records its identity in kv', async () => {
    const { ctx, sessions, pinned, createdCount } = harness()
    const kv = await openKv()

    const session = await ensureRouterSession(ctx, directory, kv)

    expect(createdCount()).toBe(1)
    expect(session.sessionId).toBe('session-1')
    expect(pinned).toEqual(['session-1'])
    expect(sessions.get('session-1')?.title).toBe(ROUTER_SESSION_TITLE)
    expect(JSON.parse(kv.get('router.session') ?? 'null')).toEqual({
      workspaceId: 'w-1',
      sessionId: 'session-1',
    })
    expect(existsSync(legacyPath())).toBe(false)
  })

  it('reuses the recorded session and restores its pin', async () => {
    const { ctx, pinned, createdCount } = harness()
    const kv = await openKv()

    const first = await ensureRouterSession(ctx, directory, kv)
    const second = await ensureRouterSession(ctx, directory, kv)

    expect(createdCount()).toBe(1)
    expect(second).toEqual(first)
    expect(pinned).toEqual(['session-1', 'session-1'])
  })

  it('migrates the legacy identity file and deletes it', async () => {
    const { ctx, pinned, createdCount } = harness(['session-legacy'])
    await writeFile(
      legacyPath(),
      JSON.stringify({ workspaceId: 'w-legacy', sessionId: 'session-legacy' }),
      'utf8',
    )
    const kv = await openKv()

    const session = await ensureRouterSession(ctx, directory, kv)

    expect(createdCount()).toBe(0)
    expect(session).toEqual({ workspaceId: 'w-legacy', sessionId: 'session-legacy' })
    expect(pinned).toEqual(['session-legacy'])
    expect(JSON.parse(kv.get('router.session') ?? 'null')).toEqual({
      workspaceId: 'w-legacy',
      sessionId: 'session-legacy',
    })
    expect(existsSync(legacyPath())).toBe(false)
  })

  it('keeps the legacy file when its session is already gone', async () => {
    const { ctx, createdCount } = harness()
    await writeFile(
      legacyPath(),
      JSON.stringify({ workspaceId: 'w-gone', sessionId: 'session-gone' }),
      'utf8',
    )
    const kv = await openKv()

    const session = await ensureRouterSession(ctx, directory, kv)

    expect(createdCount()).toBe(1)
    expect(session.sessionId).toBe('session-1')
    expect(JSON.parse(kv.get('router.session') ?? 'null')).toMatchObject({ sessionId: 'session-1' })
    expect(existsSync(legacyPath())).toBe(false)
  })

  it('creates a new session when the recorded one disappeared', async () => {
    const { ctx, createdCount } = harness()
    const kv = await openKv()
    await kv.set('router.session', JSON.stringify({ workspaceId: 'w-old', sessionId: 'session-gone' }))

    const session = await ensureRouterSession(ctx, directory, kv)

    expect(createdCount()).toBe(1)
    expect(session.sessionId).toBe('session-1')
    expect(JSON.parse(kv.get('router.session') ?? 'null')).toMatchObject({ sessionId: 'session-1' })
  })

  it('treats a corrupt kv record as absent', async () => {
    const { ctx, createdCount } = harness()
    const kv = await openKv()
    await kv.set('router.session', '{not json')

    const session = await ensureRouterSession(ctx, directory, kv)

    expect(createdCount()).toBe(1)
    expect(session.sessionId).toBe('session-1')
  })

  it('writes the identity into kv as a stable JSON record', async () => {
    const { ctx } = harness()
    const kv = await openKv()

    await ensureRouterSession(ctx, directory, kv)

    const raw = await readFile(join(directory, 'kv.json'), 'utf8')
    expect(JSON.parse(raw)['router.session']).toBe(
      JSON.stringify({ workspaceId: 'w-1', sessionId: 'session-1' }),
    )
  })

  it('replaces an archived recorded session instead of pinning it', async () => {
    const { ctx, pinned, createdCount, archive } = harness(['session-archived'])
    archive('session-archived')
    const kv = await openKv()
    await kv.set('router.session', JSON.stringify({ workspaceId: 'w-old', sessionId: 'session-archived' }))

    const session = await ensureRouterSession(ctx, directory, kv)

    expect(createdCount()).toBe(1)
    expect(session.sessionId).toBe('session-1')
    expect(pinned).toEqual(['session-1'])
    expect(JSON.parse(kv.get('router.session') ?? 'null')).toMatchObject({ sessionId: 'session-1' })
  })

  it('does not rebind to the old session after it is restored', async () => {
    const { ctx, pinned, createdCount, archive, restore } = harness(['session-archived'])
    archive('session-archived')
    const kv = await openKv()
    await kv.set('router.session', JSON.stringify({ workspaceId: 'w-old', sessionId: 'session-archived' }))

    const first = await ensureRouterSession(ctx, directory, kv)
    restore('session-archived')
    const second = await ensureRouterSession(ctx, directory, kv)

    expect(second).toEqual(first)
    expect(createdCount()).toBe(1)
    expect(pinned).toEqual(['session-1', 'session-1'])
  })
})

describe('registerRouterArchiveRebind', () => {
  it('releases and rebuilds the identity when the current router is archived', async () => {
    const { ctx, pinned, createdCount, archive, emitArchived } = harness(['session-router'])
    const kv = await openKv()
    await kv.set('router.session', JSON.stringify({ workspaceId: 'w-1', sessionId: 'session-router' }))
    const rebounded: string[] = []
    registerRouterArchiveRebind({
      ctx,
      stateDirectory: directory,
      identities: kv,
      currentRouterSessionId: () => 'session-router',
      onRebound: session => {
        rebounded.push(session.sessionId)
      },
    })

    archive('session-router')
    emitArchived('session-router')
    await vi.waitFor(() => expect(rebounded).toEqual(['session-1']))

    expect(createdCount()).toBe(1)
    expect(pinned).toEqual(['session-1'])
    expect(JSON.parse(kv.get('router.session') ?? 'null')).toMatchObject({ sessionId: 'session-1' })
  })

  it('ignores archives of other sessions', async () => {
    const { ctx, createdCount, archive, emitArchived } = harness(['session-router', 'session-worker'])
    const kv = await openKv()
    const rebounded: string[] = []
    registerRouterArchiveRebind({
      ctx,
      stateDirectory: directory,
      identities: kv,
      currentRouterSessionId: () => 'session-router',
      onRebound: session => {
        rebounded.push(session.sessionId)
      },
    })

    archive('session-worker')
    emitArchived('session-worker')
    await Promise.resolve()

    expect(rebounded).toEqual([])
    expect(createdCount()).toBe(0)
    expect(kv.get('router.session')).toBeUndefined()
  })

  it('stops listening after disposal', async () => {
    const { ctx, createdCount, archive, emitArchived } = harness(['session-router'])
    const kv = await openKv()
    const rebounded: string[] = []
    const dispose = registerRouterArchiveRebind({
      ctx,
      stateDirectory: directory,
      identities: kv,
      currentRouterSessionId: () => 'session-router',
      onRebound: session => {
        rebounded.push(session.sessionId)
      },
    })

    dispose()
    archive('session-router')
    emitArchived('session-router')
    await Promise.resolve()

    expect(rebounded).toEqual([])
    expect(createdCount()).toBe(0)
  })
})

describe('releaseRouterIdentity', () => {
  it('clears the recorded identity without creating a session', async () => {
    const kv = await openKv()
    await kv.set('router.session', JSON.stringify({ workspaceId: 'w-old', sessionId: 'session-old' }))

    await releaseRouterIdentity(kv)

    expect(kv.get('router.session')).toBeUndefined()
  })
})
