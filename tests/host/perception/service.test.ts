// tests/host/perception/service.test.ts
//
// 来源服务：创建/更新/开关/删除都先写账本再动运行时，启动失败不回滚事实但如实报错。
// 用真实账本与 kv、真实临时目录，只有宿主会话是替身。

import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { SessionId } from '@deepseek-ai/dsh-session'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPerceptionService, type PerceptionService } from '../../../src/host/perception/service.ts'
import { createClaimRegistry } from '../../../src/host/signals/claim.ts'
import { registerRouterSignalObserver } from '../../../src/host/signals/observer.ts'
import { EventStore } from '../../../src/host/store/event-store.ts'
import { KvStore } from '../../../src/host/store/kv-store.ts'
import { createFakeHost, type FakeHost } from '../../support/fake-host.ts'

const ROUTER = 'session-router'

let directory: string
let watchDirectory: string
let store: EventStore
let kv: KvStore
let host: FakeHost
let service: PerceptionService
let clock: number
let disposeObserver: () => void

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'pa-service-'))
  watchDirectory = await mkdtemp(join(tmpdir(), 'pa-watch-'))
  store = await EventStore.open({ directory })
  kv = await KvStore.open({ directory })
  host = createFakeHost({ liveSessionIds: [ROUTER], emitSpliceOnDelivery: true })
  clock = 1_700_000_000_000
  // 投递之后由观察者记账：这条链路在真实宿主里也是这样接起来的。
  disposeObserver = registerRouterSignalObserver({
    ctx: host.ctx,
    store,
    claims: createClaimRegistry(),
    currentRouterSessionId: () => ROUTER,
  })
  service = createPerceptionService({
    ctx: host.ctx,
    store,
    kv,
    stateDirectory: directory,
    currentRouterSessionId: () => ROUTER as SessionId,
    now: () => (clock += 1_000),
  })
})

afterEach(async () => {
  service.stop()
  disposeObserver()
  store.close()
  await kv.close()
  await rm(directory, { recursive: true, force: true })
  await rm(watchDirectory, { recursive: true, force: true })
})

afterEach(async () => {
  service.stop()
  store.close()
  await kv.close()
  await rm(directory, { recursive: true, force: true })
  await rm(watchDirectory, { recursive: true, force: true })
})

function watchInput(name = '本地文件'): Record<string, unknown> {
  return {
    name,
    channel: { kind: 'fs-watch', paths: [watchDirectory], debounceMs: 40 },
    threads: [{ id: 'changes', name: '变更', enabled: true }],
  }
}

describe('create', () => {
  it('records the definition and starts the channel', async () => {
    const view = await service.create(watchInput())

    expect(view).toMatchObject({ name: '本地文件', channelKind: 'fs-watch', enabled: true, status: 'running' })
    expect(store.events().map(event => event.type)).toEqual(['source/created'])
    expect(service.sources().map(source => source.id)).toEqual([view.id])
  })

  it('writes the script body to disk for a script channel', async () => {
    const view = await service.create({
      name: '脚本来源',
      script: 'console.log("hi")\n',
      channel: { kind: 'script', command: process.execPath, args: ['{script}'] },
      threads: [{ id: 'out', name: '输出', enabled: true }],
    })

    const definition = store.projection().sourceDefinitions.get(view.id)
    expect(definition?.channel.kind).toBe('script')
    if (definition?.channel.kind !== 'script') throw new Error('expected a script channel')
    expect(definition.channel.scriptPath).toMatch(/^perception\//)
    expect(definition.channel.scriptHash).toMatch(/^[0-9a-f]{32}$/)
    expect(await readFile(join(directory, definition.channel.scriptPath), 'utf8')).toBe('console.log("hi")\n')
  })

  it('rejects invalid input without writing anything', async () => {
    await expect(service.create({ name: '' })).rejects.toMatchObject({ code: 'source-invalid' })

    expect(store.events()).toEqual([])
  })

  it('rejects a source beyond the count limit', async () => {
    for (let index = 0; index < 32; index += 1) {
      await service.create(watchInput(`来源 ${index}`))
    }

    await expect(service.create(watchInput('第三十三个'))).rejects.toMatchObject({ code: 'source-invalid' })
  })

  it('keeps the source visible as an error when the channel cannot start', async () => {
    const view = await service.create({
      name: '不存在的目录',
      channel: { kind: 'fs-watch', paths: [join(watchDirectory, 'missing')] },
      threads: [{ id: 'changes', name: '变更', enabled: true }],
    })

    expect(view.status).toBe('error')
    expect(view.lastError).toMatch(/路径不存在/)
    // 事实不可撤回：来源仍然存在，只是起不来。
    expect(store.projection().sourceDefinitions.get(view.id)).toBeDefined()
  })

  it('does not start a source created disabled', async () => {
    const view = await service.create({ ...watchInput(), enabled: false })

    expect(view).toMatchObject({ enabled: false, status: 'stopped' })
  })
})

describe('toggle', () => {
  it('stops a source and records the change', async () => {
    const view = await service.create(watchInput())

    const stopped = await service.toggle(view.id, false)

    expect(stopped).toMatchObject({ enabled: false, status: 'stopped' })
    expect(store.events().map(event => event.type)).toEqual(['source/created', 'source/updated'])
  })

  it('starts it again', async () => {
    const view = await service.create(watchInput())
    await service.toggle(view.id, false)

    const started = await service.toggle(view.id, true)

    expect(started).toMatchObject({ enabled: true, status: 'running' })
  })

  it('reports an unknown source', async () => {
    await expect(service.toggle('src-ghost', true)).rejects.toMatchObject({ code: 'source-not-found' })
  })

  it('does not record a repeated switch to the same state', async () => {
    const view = await service.create(watchInput())
    await service.toggle(view.id, false)
    const eventsBefore = store.events().length

    await service.toggle(view.id, false)

    expect(store.events()).toHaveLength(eventsBefore)
  })
})

describe('update', () => {
  it('replaces the definition and keeps the identity', async () => {
    const view = await service.create(watchInput())

    const updated = await service.update({ sourceId: view.id, name: '改名后', description: '盯一个目录' })

    expect(updated).toMatchObject({ id: view.id, name: '改名后', description: '盯一个目录', status: 'running' })
    expect(store.events().map(event => event.type)).toEqual(['source/created', 'source/updated'])
  })

  it('reports an unknown source', async () => {
    await expect(service.update({ sourceId: 'src-ghost', name: 'x' })).rejects.toMatchObject({
      code: 'source-not-found',
    })
  })
})

describe('remove', () => {
  it('stops the source and records the removal', async () => {
    const view = await service.create(watchInput())

    const removed = await service.remove(view.id)

    expect(removed).toBe(true)
    expect(service.sources()).toEqual([])
    expect(store.events().map(event => event.type)).toEqual(['source/created', 'source/removed'])
  })

  it('returns false for an unknown source', async () => {
    await expect(service.remove('src-ghost')).resolves.toBe(false)
  })

  it('clears the throttle state of the removed source', async () => {
    const view = await service.create(watchInput())
    await kv.set(`perception/${view.id}/changes/last-delivered`, '1')

    await service.remove(view.id)

    expect(kv.get(`perception/${view.id}/changes/last-delivered`)).toBeUndefined()
  })
})

describe('start', () => {
  it('restores sources from the ledger and starts the enabled ones', async () => {
    await service.create(watchInput('甲'))
    await service.create({ ...watchInput('乙'), enabled: false })
    service.stop()

    const restarted = createPerceptionService({
      ctx: host.ctx,
      store,
      kv,
      stateDirectory: directory,
      currentRouterSessionId: () => ROUTER as SessionId,
      now: () => (clock += 1_000),
    })
    await restarted.start()

    const views = restarted.sources()
    expect(views.map(view => [view.name, view.enabled, view.status])).toEqual([
      ['甲', true, 'running'],
      ['乙', false, 'stopped'],
    ])
    restarted.stop()
  })

  it('leaves a source with an unknown channel kind in error state', async () => {
    // 模拟历史账本里出现了本版本不再支持的渠道。
    store.append({
      type: 'source/created',
      actor: 'system',
      correlationId: 'src-legacy',
      payload: {
        sourceId: 'src-legacy',
        definition: {
          id: 'src-legacy',
          name: '旧渠道',
          enabled: true,
          channel: { kind: 'webhook' } as never,
          threads: [{ id: 'changes', name: '变更', enabled: true }],
          createdAt: 1,
          updatedAt: 1,
        },
      },
    })

    await service.start()

    expect(service.sources()[0]).toMatchObject({ id: 'src-legacy', status: 'error' })
    expect(service.sources()[0]?.lastError).toMatch(/不支持的渠道/)
  })
})

describe('sources view', () => {
  it('reports the counts recorded by the signals', async () => {
    const view = await service.create(watchInput())
    store.append({
      type: 'signal/received',
      actor: 'system',
      correlationId: 's-perception1',
      payload: {
        kind: 'perception',
        delivered: true,
        receivedAt: 1_700_000_000_000,
        signalId: 's-perception1',
        sourceId: view.id,
        threadId: 'changes',
        text: '文件被修改',
      },
    })

    expect(service.sources()[0]).toMatchObject({
      id: view.id,
      deliveredCount: 1,
      filteredCount: 0,
      lastEventAt: 1_700_000_000_000,
    })
    expect(service.sources()[0]?.threads[0]).toMatchObject({ id: 'changes', deliveredCount: 1 })
  })

  it('exposes the current definitions for the tools', async () => {
    const view = await service.create(watchInput())

    expect(service.definitions().map(definition => definition.id)).toEqual([view.id])
  })
})

describe('script storage', () => {
  it('treats a hand-edited script as the new truth', async () => {
    const created = await service.create({
      name: '会被手改的脚本',
      script: 'console.log("v1")\n',
      channel: { kind: 'script', command: process.execPath, args: ['{script}'], restart: 'never' },
      threads: [{ id: 'out', name: '输出', enabled: true }],
    })
    const definition = store.projection().sourceDefinitions.get(created.id)
    if (definition?.channel.kind !== 'script') throw new Error('expected a script channel')
    const scriptFile = join(directory, definition.channel.scriptPath)
    await writeFile(scriptFile, 'console.log("v2")\n', 'utf8')

    service.stop()
    const restarted = createPerceptionService({
      ctx: host.ctx,
      store,
      kv,
      stateDirectory: directory,
      currentRouterSessionId: () => ROUTER as SessionId,
    })
    await restarted.start()

    const updated = restarted.definitions()[0]
    if (updated?.channel.kind !== 'script') throw new Error('expected a script channel')
    expect(updated.channel.scriptHash).not.toBe(definition.channel.scriptHash)
    restarted.stop()
  })
})

describe('thread toggle', () => {
  it('stops only the thread that is switched off', async () => {
    const view = await service.create({
      name: '双线程来源',
      channel: { kind: 'fs-watch', paths: [watchDirectory], debounceMs: 40 },
      threads: [
        { id: 'markdown', name: 'Markdown', enabled: true },
        { id: 'logs', name: '日志', enabled: true },
      ],
    })

    const updated = await service.toggle(view.id, false, 'logs')

    expect(updated.threads.map(thread => [thread.id, thread.enabled])).toEqual([
      ['markdown', true],
      ['logs', false],
    ])
    expect(updated.enabled).toBe(true)

    await writeFile(join(watchDirectory, 'note.md'), 'hello', 'utf8')
    await vi.waitFor(() => expect(store.projection().signals.length).toBe(1), {
      timeout: 3_000,
      interval: 20,
    })
    expect(store.projection().signals.map(signal => signal.threadId)).toEqual(['markdown'])
  })

  it('reports an unknown thread', async () => {
    const view = await service.create(watchInput())

    await expect(service.toggle(view.id, false, 'ghost')).rejects.toMatchObject({
      code: 'source-invalid',
    })
  })

  it('does not record anything when the thread is already in that state', async () => {
    const view = await service.create(watchInput())
    const eventsBefore = store.events().length

    const unchanged = await service.toggle(view.id, true, 'changes')

    expect(unchanged.threads[0]?.enabled).toBe(true)
    expect(store.events()).toHaveLength(eventsBefore)
  })
})

describe('restart', () => {
  it('starts an enabled source again after a failed start', async () => {
    const view = await service.create(watchInput())
    await service.toggle(view.id, false)
    await rm(watchDirectory, { recursive: true, force: true })

    const failed = await service.toggle(view.id, true)
    expect(failed).toMatchObject({ enabled: true, status: 'error' })

    await mkdir(watchDirectory, { recursive: true })
    const restarted = await service.toggle(view.id, true)

    expect(restarted).toMatchObject({ enabled: true, status: 'running' })
    expect(restarted.lastError).toBeUndefined()
    // 重启只动运行时：定义没变，账本不该多出一条事实。
    expect(store.events().map(event => event.type)).toEqual([
      'source/created',
      'source/updated',
      'source/updated',
    ])
  })
})

describe('test', () => {
  it('delivers a synthetic fact for a file source', async () => {
    const view = await service.create(watchInput())

    const signals = await service.test(view.id)

    expect(signals).toHaveLength(1)
    expect(signals[0]).toMatchObject({
      kind: 'perception',
      delivered: true,
      sourceId: view.id,
      threadId: 'changes',
    })
    expect(signals[0]?.text).toContain('[test]')
    expect(host.sessions.get(ROUTER)?.delivered).toHaveLength(1)
  })

  it('collects the output of a script source within the wait window', async () => {
    const view = await service.create({
      name: '脚本来源',
      script:
        'process.stdout.write(JSON.stringify({thread:"out",statement:"脚本说 "+Date.now(),externalId:String(Date.now())})+"\\n")\n',
      channel: { kind: 'script', command: process.execPath, args: ['{script}'], restart: 'never' },
      threads: [{ id: 'out', name: '输出', enabled: true }],
    })

    const signals = await service.test(view.id, 3_000)

    expect(signals.length).toBeGreaterThan(0)
    expect(signals[0]?.text).toMatch(/^脚本说 \d+$/)
  })

  it('reports the latest signals of a host-event source without firing it again', async () => {
    const view = await service.create({
      name: '事件来源',
      channel: {
        kind: 'host-event',
        subscriptions: [{ event: 'task/closed', thread: 'closed', statement: '工单 {payload.ticketId} 结束' }],
      },
      threads: [{ id: 'closed', name: '关闭', enabled: true }],
    })
    store.append({
      type: 'task/closed',
      actor: 'system',
      correlationId: 't-1',
      payload: { ticketId: 't-1', outcome: 'completed' },
    })
    await vi.waitFor(() => expect(store.projection().signals.length).toBe(1), {
      timeout: 3_000,
      interval: 20,
    })

    const signals = await service.test(view.id)

    expect(signals.map(signal => signal.text)).toEqual(['工单 t-1 结束'])
    expect(store.projection().signals).toHaveLength(1)
  })

  it('rejects testing a switched-off source', async () => {
    const view = await service.create({ ...watchInput(), enabled: false })

    await expect(service.test(view.id)).rejects.toMatchObject({ code: 'source-invalid' })
  })

  it('reports an unknown source', async () => {
    await expect(service.test('src-ghost')).rejects.toMatchObject({ code: 'source-not-found' })
  })

  it('reports a failed restart instead of returning an empty list', async () => {
    const view = await service.create({
      name: '会消失的脚本',
      script: 'process.stdout.write("{\\"thread\\":\\"out\\",\\"statement\\":\\"OK\\"}\\n")\n',
      channel: { kind: 'script', command: process.execPath, args: ['{script}'], restart: 'never' },
      threads: [{ id: 'out', name: '输出', enabled: true }],
    })
    const definition = store.projection().sourceDefinitions.get(view.id)
    if (definition?.channel.kind !== 'script') throw new Error('expected a script channel')
    await rm(join(directory, definition.channel.scriptPath), { force: true })

    await expect(service.test(view.id, 0)).rejects.toMatchObject({ code: 'source-start-failed' })
  })
})

describe('end to end', () => {
  it('turns a file change into a signal delivered to the router', async () => {
    const view = await service.create(watchInput())

    await writeFile(join(watchDirectory, 'note.md'), 'hello', 'utf8')

    await vi.waitFor(() => expect(store.projection().signals.length).toBe(1), { timeout: 3_000, interval: 20 })
    expect(store.projection().signals[0]).toMatchObject({
      kind: 'perception',
      delivered: true,
      sourceId: view.id,
      threadId: 'changes',
    })
    const delivered = host.sessions.get(ROUTER)?.delivered ?? []
    expect(delivered).toHaveLength(1)
    expect(delivered[0]?.text).toContain('[感知事件]')
    expect(delivered[0]?.text).toContain('来源：本地文件 · 变更')
  })

  it('stays silent after the source is switched off', async () => {
    const view = await service.create(watchInput())
    await writeFile(join(watchDirectory, 'first.md'), 'x', 'utf8')
    await vi.waitFor(() => expect(store.projection().signals.length).toBe(1), { timeout: 3_000, interval: 20 })

    await service.toggle(view.id, false)
    await writeFile(join(watchDirectory, 'second.md'), 'y', 'utf8')
    await new Promise(resolve => setTimeout(resolve, 400))

    expect(store.projection().signals).toHaveLength(1)
    expect(host.sessions.get(ROUTER)?.delivered).toHaveLength(1)
  })

  it('only triggers the thread whose match accepts the fact', async () => {
    await service.create({
      name: '双线程来源',
      channel: { kind: 'fs-watch', paths: [watchDirectory], debounceMs: 40 },
      threads: [
        { id: 'markdown', name: 'Markdown', enabled: true, match: { path: 'name', op: 'endsWith', value: '.md' } },
        { id: 'logs', name: '日志', enabled: true, match: { path: 'name', op: 'endsWith', value: '.log' } },
      ],
    })

    await writeFile(join(watchDirectory, 'note.md'), 'hello', 'utf8')

    await vi.waitFor(() => expect(store.projection().signals.length).toBeGreaterThanOrEqual(1), {
      timeout: 3_000,
      interval: 20,
    })
    const signals = store.projection().signals
    const deliveredSignals = signals.filter(signal => signal.delivered)
    expect(deliveredSignals.map(signal => signal.threadId)).toEqual(['markdown'])
  })
})
