// src/host/store/event-store.ts
//
// 账本写入口：唯一允许追加事件的地方。顺序固定为「分配 seq → 写盘并 fsync →
// 改内存」，因此进程内看到的事件一定已经落盘；写入失败会回滚文件长度并让内存
// 保持原样，避免出现「账本没有、投影有」的事实。

import { closeSync, fsyncSync, ftruncateSync, openSync, readFileSync, writeSync } from 'node:fs'
import { join } from 'node:path'
import type { EventDraft, L2Event } from '../../shared/events.ts'
import { project, type Projection } from '../projector/project.ts'
import { ensureDirectory } from '../state/directory.ts'
import { deriveEventId } from './event-id.ts'
import { encodeLedgerLine, EVENTS_FILE_NAME, replayLedger } from './ledger-format.ts'

export interface AppendResult {
  event: L2Event
  /** `true` 表示该 eventId 已入账：外部副作用不应因重复调用再执行一次。 */
  duplicate: boolean
}

/** 账本写入通知：只在真正写入成功后同步回调。 */
export type EventListener = (event: L2Event) => void

export interface EventStoreOptions {
  /** 状态目录；账本落在它下面的 `events.jsonl`。 */
  directory: string
  /** 注入时钟，便于测试得到确定的时间戳。 */
  now?: () => number
  /** 重放期的降级事实（残行、未知类型、重复行）交给调用方记日志。 */
  onWarning?: (message: string) => void
}

export class EventStore {
  readonly #now: () => number
  readonly #ledger: L2Event[] = []
  readonly #byEventId = new Map<string, L2Event>()
  readonly #listeners = new Set<EventListener>()
  #onWarning: ((message: string) => void) | undefined
  #fd: number | undefined
  /** 已落盘字节数：写入失败时回滚到这里。 */
  #size = 0
  #nextSeq = 1
  #projection: Projection | undefined
  /** 写入回滚失败后的降级状态：账本可能已不一致，只允许重启修复。 */
  #fault: string | undefined

  private constructor(now: () => number) {
    this.#now = now
  }

  /**
   * 打开账本：建目录、重放、必要时截断尾部残行，然后持有追加句柄。
   *
   * @throws LedgerCorruptionError 完整行损坏或序号断裂时；此时不应继续写入。
   */
  static async open(options: EventStoreOptions): Promise<EventStore> {
    const directory = await ensureDirectory(options.directory)
    const path = join(directory, EVENTS_FILE_NAME)
    const bytes = readLedgerFile(path)
    const replayed = replayLedger(bytes)

    if (replayed.truncateTo !== undefined) {
      const fd = openSync(path, 'r+')
      try {
        ftruncateSync(fd, replayed.truncateTo)
      } finally {
        closeSync(fd)
      }
    }
    // 截断成功后才把降级事实报出去：日志不能说一件没做成的事。
    for (const warning of replayed.warnings) options.onWarning?.(warning)

    const store = new EventStore(options.now ?? Date.now)
    store.#onWarning = options.onWarning
    for (const event of replayed.events) {
      // 重放事件与 append 事件走同一条只读边界：账本对象一旦入内存就不再可变。
      deepFreeze(event)
      store.#ledger.push(event)
      store.#byEventId.set(event.eventId, event)
    }
    store.#nextSeq = replayed.lastSeq + 1
    store.#size = replayed.truncateTo ?? bytes.length
    store.#fd = openSync(path, 'a')
    return store
  }

  /**
   * 追加一条事实。
   *
   * @returns 已落账事件与是否由幂等命中；重复命中不写盘、不推进 seq。
   */
  append(draft: EventDraft): AppendResult {
    if (this.#fault !== undefined) {
      throw new Error(`${this.#fault}; the ledger rejects further appends until the plugin restarts`)
    }
    if (this.#fd === undefined) {
      throw new Error('EventStore is closed; append is rejected')
    }

    const eventId = deriveEventId(draft)
    const existing = this.#byEventId.get(eventId)
    if (existing !== undefined) return { event: existing, duplicate: true }

    const seq = this.#nextSeq
    // 技术字段在此补齐；payload 的形状由生产者类型保证（重放侧另有运行时校验）。
    // 冻结让 `events()` 的只读承诺成立：调用方改不动已入账的事实。
    const event = deepFreeze({ ...draft, seq, eventId, time: this.#now() } as L2Event)
    const line = encodeLedgerLine(event)
    const bytes = Buffer.byteLength(line, 'utf8')
    const sizeBefore = this.#size

    try {
      const written = writeSync(this.#fd, line)
      if (written !== bytes) throw new Error(`partial ledger write: ${written}/${bytes} bytes`)
      fsyncSync(this.#fd)
    } catch (error) {
      try {
        ftruncateSync(this.#fd, sizeBefore)
      } catch (rollbackError) {
        this.#fault = `ledger rollback failed after a write error (${describe(rollbackError)})`
      }
      throw error
    }

    this.#size = sizeBefore + bytes
    this.#nextSeq = seq + 1
    this.#byEventId.set(eventId, event)
    this.#ledger.push(event)
    this.#projection = undefined
    // 落盘与内存都更新之后再通知：订阅者看到的事件一定已经在账本里。
    this.#notify(event)
    return { event, duplicate: false }
  }

  /**
   * 订阅新写入的事件，返回注销函数。
   *
   * 通知是同步的，发生在 `append` 返回之前；监听器只该做入队与过滤，不能重入
   * `append`。重放的历史事件不会补发——订阅者要历史就去读投影。
   */
  subscribe(listener: EventListener): () => void {
    this.#listeners.add(listener)
    return () => {
      this.#listeners.delete(listener)
    }
  }

  /** 已落账事件的只读副本：调用方无法借它改写账本视图。 */
  events(): readonly L2Event[] {
    return [...this.#ledger]
  }

  /**
   * 逐个通知监听器。
   *
   * 监听器抛错降级为告警：事件已经落盘，把一个订阅者的故障冒泡给写入方，会让
   * 一次成功的写入看起来失败了。
   */
  #notify(event: L2Event): void {
    for (const listener of [...this.#listeners]) {
      try {
        listener(event)
      } catch (error) {
        this.#onWarning?.(`ledger listener failed: ${describe(error)}`)
      }
    }
  }

  /** 当前投影；每次 append 后失效，下一次读取时重算。 */
  projection(): Projection {
    this.#projection ??= project(this.#ledger)
    return this.#projection
  }

  /** 释放追加句柄；重复调用无副作用。 */
  close(): void {
    if (this.#fd === undefined) return
    closeSync(this.#fd)
    this.#fd = undefined
  }
}

function readLedgerFile(path: string): Buffer {
  try {
    return readFileSync(path)
  } catch (error) {
    // 首次启动没有账本文件：空账本，不是错误。
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return Buffer.alloc(0)
    throw error
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** 递归冻结一条事件（payload 是 JSON 结构，没有循环引用）。 */
function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    if (Object.isFrozen(value)) return value
    Object.freeze(value)
    for (const item of Object.values(value as Record<string, unknown>)) deepFreeze(item)
  }
  return value
}
