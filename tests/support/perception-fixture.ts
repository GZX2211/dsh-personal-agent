// tests/support/perception-fixture.ts
//
// 来源工具测试的共享夹具：真实账本与 kv、真实临时目录、真实的来源服务，
// 只有宿主会话是替身。工具本身很薄，值得验证的是「参数到服务、结果到模型」这条链。

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { SessionId } from '@deepseek-ai/dsh-session'
import type { ToolRunContext } from '@deepseek-ai/dsh-tools'
import { createPerceptionService, type PerceptionService } from '../../src/host/perception/service.ts'
import { EventStore } from '../../src/host/store/event-store.ts'
import { KvStore } from '../../src/host/store/kv-store.ts'
import { createFakeHost, type FakeHost } from './fake-host.ts'

export const FIXTURE_ROUTER = 'session-router'

export interface PerceptionFixture {
  service: PerceptionService
  host: FakeHost
  store: EventStore
  directory: string
  watchDirectory: string
  close(): Promise<void>
}

export async function createPerceptionFixture(): Promise<PerceptionFixture> {
  const directory = await mkdtemp(join(tmpdir(), 'pa-tool-'))
  const watchDirectory = await mkdtemp(join(tmpdir(), 'pa-tool-watch-'))
  const store = await EventStore.open({ directory })
  const kv = await KvStore.open({ directory })
  const host = createFakeHost({ liveSessionIds: [FIXTURE_ROUTER], emitSpliceOnDelivery: true })
  let clock = 1_700_000_000_000
  const service = createPerceptionService({
    ctx: host.ctx,
    store,
    kv,
    stateDirectory: directory,
    currentRouterSessionId: () => FIXTURE_ROUTER as SessionId,
    now: () => (clock += 1_000),
  })

  return {
    service,
    host,
    store,
    directory,
    watchDirectory,
    async close() {
      service.stop()
      store.close()
      await kv.close()
      await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
      await rm(watchDirectory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
    },
  }
}

/** 来源工具不读会话上下文；这里只提供一个形状正确的最小执行上下文。 */
export function toolContext(): ToolRunContext {
  return {
    signal: new AbortController().signal,
    callId: 'call-1',
    rootCallId: 'call-1',
    name: 'pa_source_tool',
    arguments: {},
    token: Symbol('call'),
  } as unknown as ToolRunContext
}

/** 一个合法的 fs-watch 来源参数。 */
export function watchSourceInput(watchDirectory: string, name = '本地文件'): Record<string, unknown> {
  return {
    name,
    channel: { kind: 'fs-watch', paths: [watchDirectory], debounceMs: 40 },
    threads: [{ id: 'changes', name: '变更', enabled: true }],
  }
}
