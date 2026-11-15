// src/host/store/kv-store.ts
//
// 技术元数据（router 会话身份等）的侧车存储。与 append-only 账本分开：
// 这些值允许改写，因此走「读全量 → 改内存 → 原子替换文件」的简单模型。
// 写坏 kv 不该影响业务事实，所以读取损坏时降级为空并告警。

import { readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ensureDirectory } from '../state/directory.ts'

export const KV_FILE_NAME = 'kv.json'

export interface KvStoreOptions {
  /** 状态目录；kv 落在它下面的 `kv.json`。 */
  directory: string
  /** 降级事实（文件损坏、非对象内容）交给调用方记日志。 */
  onWarning?: (message: string) => void
}

export class KvStore {
  readonly #path: string
  readonly #values: Record<string, string>
  #queue: Promise<void> = Promise.resolve()
  #closed = false

  private constructor(path: string, values: Record<string, string>) {
    this.#path = path
    this.#values = values
  }

  /** 打开 kv：缺文件视为空，损坏则告警降级为空（不删除用户文件）。 */
  static async open(options: KvStoreOptions): Promise<KvStore> {
    const directory = await ensureDirectory(options.directory)
    const path = join(directory, KV_FILE_NAME)

    let raw: string | undefined
    try {
      raw = await readFile(path, 'utf8')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }

    const values: Record<string, string> = {}
    if (raw !== undefined && raw.trim().length > 0) {
      try {
        const parsed: unknown = JSON.parse(raw)
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          throw new Error('content is not a JSON object')
        }
        for (const [key, value] of Object.entries(parsed)) {
          if (typeof value === 'string') values[key] = value
        }
      } catch (error) {
        options.onWarning?.(
          `kv.json is unreadable (${error instanceof Error ? error.message : String(error)}); technical metadata starts empty`,
        )
      }
    }

    return new KvStore(path, values)
  }

  get(key: string): string | undefined {
    return this.#values[key]
  }

  async set(key: string, value: string): Promise<void> {
    this.#ensureOpen()
    this.#values[key] = value
    await this.#persist()
  }

  async delete(key: string): Promise<void> {
    this.#ensureOpen()
    delete this.#values[key]
    await this.#persist()
  }

  /** 等排队的写入落地；之后拒绝新的写入。 */
  async close(): Promise<void> {
    this.#closed = true
    await this.#queue
  }

  #ensureOpen(): void {
    if (this.#closed) throw new Error('KvStore is closed; writes are rejected')
  }

  /** 串行写入：并发 set 不会互相覆盖临时文件。 */
  #persist(): Promise<void> {
    const write = this.#queue.catch(() => undefined).then(() => this.#writeAtomic())
    this.#queue = write
    return write
  }

  async #writeAtomic(): Promise<void> {
    const temporary = `${this.#path}.tmp`
    await writeFile(temporary, `${JSON.stringify(this.#values)}\n`, 'utf8')
    await rename(temporary, this.#path)
  }
}
