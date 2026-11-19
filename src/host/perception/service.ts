// src/host/perception/service.ts
//
// 来源服务：来源定义的唯一写入口，也是 Channel 生命周期的所有者。
//
// 顺序固定为「先写账本事实，再动运行时」：删除与开关先停旧渠道，创建与更新先落地
// 事实再启动。启动失败不回滚事实——「用户确实创建了它」是不可撤回的，来源保持
// enabled 但状态为 error，页面提供重启。

import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { HarnessError } from '@deepseek-ai/dsh-llm'
import type { SessionId } from '@deepseek-ai/dsh-session'
import type {
  ChannelDefinition,
  SourceDefinition,
  SourceView,
  ThreadDefinition,
} from '../../shared/sources.ts'
import { SOURCE_LIMITS } from '../../shared/sources.ts'
import type { HostContext } from '../context.ts'
import { createSourceId } from '../ids.ts'
import type { EventStore } from '../store/event-store.ts'
import type { KvStore } from '../store/kv-store.ts'
import { deliverPerceptionNotice } from './delivery.ts'
import { createChannelRegistry } from './registry.ts'
import { createSourceRuntime } from './runtime.ts'
import { createPerceptionState } from './state.ts'
import type { ChannelContext } from './types.ts'
import {
  checkSourceDefinition,
  parseSourceInput,
  type ParsedChannel,
  type ParsedSourceInput,
} from './validate.ts'

export type PerceptionErrorCode = 'source-not-found' | 'source-invalid' | 'source-start-failed'

export class PerceptionError extends HarnessError {
  constructor(message: string, code: PerceptionErrorCode) {
    super(message, code)
    this.name = 'PerceptionError'
  }
}

export interface PerceptionService {
  /** 从账本还原来源并启动 enabled 的渠道；重复调用无副作用。 */
  start(): Promise<void>
  /** 停止全部渠道；之后不再接受任何候选。 */
  stop(): void
  /** 来源页的视图：投影里的定义与计数，加上运行时状态。 */
  sources(): SourceView[]
  /** 当前未删除的定义；工具据此决定改哪些字段。 */
  definitions(): readonly SourceDefinition[]
  create(raw: unknown): Promise<SourceView>
  update(raw: unknown): Promise<SourceView>
  toggle(sourceId: string, enabled: boolean): Promise<SourceView>
  remove(sourceId: string): Promise<boolean>
}

export interface PerceptionServiceOptions {
  ctx: HostContext
  store: EventStore
  kv: KvStore
  stateDirectory: string
  /** router 身份是异步确定的，投递时再读。 */
  currentRouterSessionId: () => SessionId | undefined
  now?: () => number
  log?: (message: string) => void
}

interface RunningSource {
  stop: () => void
  status: 'running' | 'error'
  lastError?: string
}

export function createPerceptionService(options: PerceptionServiceOptions): PerceptionService {
  const now = options.now ?? Date.now
  const state = createPerceptionState(options.kv)
  const registry = createChannelRegistry({
    subscribeLedger: listener => options.store.subscribe(listener),
    stateDirectory: options.stateDirectory,
  })
  /** 运行中的渠道；不在这里的来源就是「已停止」。 */
  const running = new Map<string, RunningSource>()
  let started = false

  function definitionOf(sourceId: string): SourceDefinition | undefined {
    return options.store.projection().sourceDefinitions.get(sourceId)
  }

  function viewOf(sourceId: string): SourceView {
    const view = sources().find(source => source.id === sourceId)
    if (view === undefined) throw new PerceptionError(`来源不存在：${sourceId}`, 'source-not-found')
    return view
  }

  function sources(): SourceView[] {
    const projection = options.store.projection()
    return projection.sources.map(snapshot => {
      const runtime = running.get(snapshot.id)
      const view: SourceView = {
        ...snapshot,
        status: runtime?.status ?? 'stopped',
      }
      if (runtime?.lastError !== undefined) view.lastError = runtime.lastError
      return view
    })
  }

  function stopSource(sourceId: string): void {
    const current = running.get(sourceId)
    running.delete(sourceId)
    if (current === undefined) return
    try {
      current.stop()
    } catch (error) {
      options.log?.(`停止来源 ${sourceId} 失败：${describe(error)}`)
    }
  }

  function startSource(definition: SourceDefinition): void {
    if (!definition.enabled) return
    const factory = registry.factoryFor(definition.channel.kind)
    if (factory === undefined) {
      running.set(definition.id, {
        stop: () => undefined,
        status: 'error',
        lastError: `不支持的渠道：${definition.channel.kind}`,
      })
      return
    }

    const runtime = createSourceRuntime({
      definition,
      store: options.store,
      state,
      now,
      deliver: notice =>
        deliverPerceptionNotice(
          { ctx: options.ctx, currentRouterSessionId: options.currentRouterSessionId },
          notice,
        ),
      onError: message => {
        const current = running.get(definition.id)
        if (current !== undefined) current.lastError = message
        options.log?.(`来源 ${definition.id}：${message}`)
      },
    })

    // 候选按到达顺序串行处理：同线程的节流与去重依赖这个顺序。
    let queue: Promise<void> = Promise.resolve()
    const context: ChannelContext = {
      sourceId: definition.id,
      channel: definition.channel,
      threads: definition.threads,
      emit: candidate => {
        queue = queue
          .then(() => runtime.accept(candidate))
          .catch(error => options.log?.(`来源 ${definition.id} 处理候选失败：${describe(error)}`))
      },
      warn: message => options.log?.(`来源 ${definition.id}：${message}`),
    }

    try {
      const stopChannel = factory(context).start()
      running.set(definition.id, { stop: stopChannel, status: 'running' })
    } catch (error) {
      running.set(definition.id, { stop: () => undefined, status: 'error', lastError: describe(error) })
    }
  }

  function writeCreated(definition: SourceDefinition): void {
    options.store.append({
      type: 'source/created',
      actor: 'router',
      correlationId: definition.id,
      payload: { sourceId: definition.id, definition },
    })
    startSource(definition)
  }

  function updateSource(next: SourceDefinition): void {
    stopSource(next.id)
    options.store.append({
      type: 'source/updated',
      actor: 'router',
      correlationId: next.id,
      payload: { sourceId: next.id, definition: next },
    })
    startSource(next)
  }

  async function materializeChannel(
    channel: ParsedChannel,
    script: string | undefined,
    sourceId: string,
  ): Promise<ChannelDefinition> {
    if (channel.kind !== 'script') return channel
    if (script === undefined) throw new PerceptionError('script Channel 缺少脚本正文', 'source-invalid')

    const fileName = `watch.${extensionFor(channel.command)}`
    const relative = join('perception', sourceId, fileName).replaceAll('\\', '/')
    const absolute = join(options.stateDirectory, relative)
    await mkdir(join(options.stateDirectory, 'perception', sourceId), { recursive: true })
    await writeFile(absolute, script, 'utf8')

    return {
      ...channel,
      scriptPath: relative,
      scriptHash: hashOf(script),
    }
  }

  /** 启动前复核已落盘的定义：历史账本可能来自更早的版本。 */
  function assertExecutable(definition: SourceDefinition): void {
    const problems = checkSourceDefinition(definition)
    if (problems.length === 0) return
    throw new PerceptionError(`来源定义不可执行：\n${problems.join('\n')}`, 'source-invalid')
  }

  function buildDefinition(
    id: string,
    input: ParsedSourceInput,
    channel: ChannelDefinition,
    threads: ThreadDefinition[],
    createdAt: number,
  ): SourceDefinition {
    const definition: SourceDefinition = {
      id,
      name: input.name as string,
      enabled: input.enabled ?? true,
      channel,
      threads,
      createdAt,
      updatedAt: now(),
    }
    if (input.description !== undefined) definition.description = input.description
    return definition
  }

  async function reconcileScriptHash(definition: SourceDefinition): Promise<SourceDefinition | undefined> {
    if (definition.channel.kind !== 'script') return undefined
    const absolute = join(options.stateDirectory, definition.channel.scriptPath)
    let content: string
    try {
      content = await readFile(absolute, 'utf8')
    } catch {
      // 文件没了：保持定义原样，启动时由渠道报「脚本文件不存在」。
      return undefined
    }
    const hash = hashOf(content)
    if (hash === definition.channel.scriptHash) return undefined
    return {
      ...definition,
      channel: { ...definition.channel, scriptHash: hash },
      updatedAt: now(),
    }
  }

  return {
    async start() {
      if (started) return
      started = true
      const projection = options.store.projection()
      state.restoreSeen(signalFacts(options.store))
      for (const definition of projection.sourceDefinitions.values()) {
        // 脚本被手改过时以文件为准：定义跟着文件走，不让下次启动悄悄跑旧内容。
        const synced = await reconcileScriptHash(definition)
        if (synced === undefined) {
          startSource(definition)
          continue
        }
        options.log?.(`来源 ${definition.id} 的脚本被手改，按文件内容更新定义`)
        options.store.append({
          type: 'source/updated',
          actor: 'system',
          correlationId: synced.id,
          payload: { sourceId: synced.id, definition: synced },
        })
        startSource(synced)
      }
    },

    stop() {
      started = false
      for (const sourceId of [...running.keys()]) stopSource(sourceId)
    },

    sources,

    definitions() {
      return [...options.store.projection().sourceDefinitions.values()]
    },

    async create(raw) {
      const parsed = parseSourceInput(raw)
      if (!parsed.ok) throw invalid(parsed.errors)
      const input = parsed.value
      if (input.name === undefined || input.channel === undefined || input.threads === undefined) {
        throw new PerceptionError('创建来源需要 name、channel 与 threads', 'source-invalid')
      }
      if (options.store.projection().sourceDefinitions.size >= SOURCE_LIMITS.sourceCount) {
        throw new PerceptionError(`来源数量已达上限 ${SOURCE_LIMITS.sourceCount}`, 'source-invalid')
      }

      const sourceId = createSourceId()
      const channel = await materializeChannel(input.channel, input.script, sourceId)
      const definition = buildDefinition(sourceId, input, channel, input.threads, now())
      assertExecutable(definition)
      writeCreated(definition)
      return viewOf(sourceId)
    },

    async update(raw) {
      const sourceId = readSourceId(raw)
      const current = definitionOf(sourceId)
      if (current === undefined) throw new PerceptionError(`来源不存在：${sourceId}`, 'source-not-found')

      const parsed = parseSourceInput(raw, { partial: true })
      if (!parsed.ok) throw invalid(parsed.errors)
      const input = parsed.value

      const channel =
        input.channel === undefined
          ? current.channel
          : await materializeChannel(input.channel, input.script, sourceId)
      const next: SourceDefinition = {
        ...current,
        name: input.name ?? current.name,
        enabled: input.enabled ?? current.enabled,
        channel,
        threads: input.threads ?? current.threads,
        updatedAt: now(),
      }
      if (input.description !== undefined) next.description = input.description
      assertExecutable(next)
      updateSource(next)
      return viewOf(sourceId)
    },

    async toggle(sourceId, enabled) {
      const current = definitionOf(sourceId)
      if (current === undefined) throw new PerceptionError(`来源不存在：${sourceId}`, 'source-not-found')
      if (current.enabled === enabled) return viewOf(sourceId)

      updateSource({ ...current, enabled, updatedAt: now() })
      return viewOf(sourceId)
    },

    async remove(sourceId) {
      const current = definitionOf(sourceId)
      stopSource(sourceId)
      if (current === undefined) return false

      options.store.append({
        type: 'source/removed',
        actor: 'router',
        correlationId: sourceId,
        payload: { sourceId },
      })
      await state.forget(
        sourceId,
        current.threads.map(thread => thread.id),
      )
      return true
    },
  }
}

function invalid(errors: readonly string[]): PerceptionError {
  return new PerceptionError(`来源参数不合法：\n${errors.join('\n')}`, 'source-invalid')
}

function readSourceId(raw: unknown): string {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new PerceptionError('参数必须是一个对象', 'source-invalid')
  }
  const sourceId = (raw as { sourceId?: unknown }).sourceId
  if (typeof sourceId !== 'string' || sourceId.length === 0) {
    throw new PerceptionError('缺少 sourceId', 'source-invalid')
  }
  return sourceId
}

/**
 * 脚本文件的扩展名。
 *
 * 只是给人和编辑器看的：真正的解释器由 `command` 与 `args` 决定。
 */
function extensionFor(command: string): string {
  const name = command.toLowerCase()
  if (name.includes('node')) return 'mjs'
  if (name.includes('pwsh') || name.includes('powershell')) return 'ps1'
  if (name.includes('python')) return 'py'
  if (name.endsWith('sh') || name.includes('bash')) return 'sh'
  return 'txt'
}

function hashOf(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex').slice(0, 32)
}

/** 账本里的全部信号坐标：去重集合按时间从旧到新重建。 */
function signalFacts(store: EventStore): { sourceId: string; threadId?: string; externalId?: string }[] {
  return store.events().flatMap(event =>
    event.type === 'signal/received' && event.payload.sourceId !== undefined
      ? [
          {
            sourceId: event.payload.sourceId,
            threadId: event.payload.threadId,
            externalId: event.payload.externalId,
          },
        ]
      : [],
  )
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
