// src/host/perception/channels/fs-watch.ts
//
// fs-watch：盯住本地路径，把文件事件变成感知候选。
//
// 每个路径一个原生监听器；同一路径的多次事件在 debounce 窗口内合并成一次，因为
// 编辑器保存一次常常产生好几个底层事件——用户要的是「这个文件变了」，不是三条。
// 一条文件事件会为每个线程各产一条候选：线程用各自的 match 决定关不关心它。

import { existsSync, statSync, watch, type FSWatcher } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import type { FsEventKind, FsWatchChannel } from '../../../shared/sources.ts'
import { FS_EVENT_KINDS } from '../../../shared/sources.ts'
import { DEFAULT_IGNORES, isIgnored } from '../fs-pattern.ts'
import { renderTemplate } from '../template.ts'
import type { ChannelContext, ChannelRuntime } from '../types.ts'

const DEFAULT_DEBOUNCE_MS = 300
/** 监听器失效后的重挂次数上限：三次仍失败就交给来源页的错误态。 */
const MAX_REATTACH = 3
const REATTACH_DELAY_MS = 1_000

export function createFsWatchChannel(context: ChannelContext): ChannelRuntime {
  return {
    start() {
      const channel = requireFsWatchChannel(context.channel)
      const paths = channel.paths

      // 启动前校验存在性：路径打不开是创建时就能发现的问题，不该等到用户以为在盯。
      for (const path of paths) {
        if (!existsSync(path)) throw new Error(`路径不存在：${path}`)
      }

      const debounceMs = channel.debounceMs ?? DEFAULT_DEBOUNCE_MS
      const ignores = [...DEFAULT_IGNORES, ...(channel.ignore ?? [])]
      const allowed = new Set<FsEventKind>(channel.events ?? FS_EVENT_KINDS)
      const pending = new Map<string, PendingFile>()
      const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>()
      const reattachTimers = new Set<ReturnType<typeof setTimeout>>()
      const watchers = new Set<FSWatcher>()
      let stopped = false

      for (const path of paths) attach(path, 0)

      return () => {
        stopped = true
        for (const watcher of watchers) watcher.close()
        watchers.clear()
        for (const timer of debounceTimers.values()) clearTimeout(timer)
        debounceTimers.clear()
        for (const timer of reattachTimers) clearTimeout(timer)
        reattachTimers.clear()
        pending.clear()
      }

      function attach(path: string, attempt: number): void {
        if (stopped) return
        let watcher: FSWatcher
        try {
          watcher = watch(path, { recursive: channel.recursive ?? false }, (eventType, filename) => {
            onEvent(path, eventType, filename)
          })
        } catch (error) {
          throw new Error(`无法监听路径 ${path}：${describe(error)}`)
        }
        watcher.on('error', error => {
          watchers.delete(watcher)
          watcher.close()
          context.warn(`监听中断（${path}）：${describe(error)}`)
          if (attempt >= MAX_REATTACH) return
          const timer = setTimeout(() => {
            reattachTimers.delete(timer)
            try {
              attach(path, attempt + 1)
            } catch (retryError) {
              context.warn(`重新监听失败（${path}）：${describe(retryError)}`)
            }
          }, REATTACH_DELAY_MS)
          reattachTimers.add(timer)
        })
        watchers.add(watcher)
      }

      function onEvent(path: string, eventType: string, filename: string | null): void {
        if (stopped) return
        const file = filename === null ? path : join(path, filename)
        // 先判忽略再排队：被忽略的路径连定时器都不该占用。
        if (isIgnored(file, ignores)) return

        // 同一路径只保留最后一次事件：debounce 结束后按它判定种类。
        pending.set(path, { file, eventType })

        const existing = debounceTimers.get(path)
        if (existing !== undefined) clearTimeout(existing)
        debounceTimers.set(
          path,
          setTimeout(() => flush(path), debounceMs),
        )
      }

      function flush(path: string): void {
        debounceTimers.delete(path)
        const item = pending.get(path)
        pending.delete(path)
        if (item === undefined || stopped) return
        emitFile(item)
      }

      function emitFile(item: PendingFile): void {
        const stat = readStat(item.file)
        const event = resolveEvent(item.eventType, stat !== undefined)
        if (!allowed.has(event)) return

        const now = Date.now()
        const normalized = item.file.replaceAll('\\', '/')
        const name = basename(item.file)
        const dir = dirname(item.file)
        const externalId =
          event === 'unlink'
            ? `${normalized}:unlink:${now}`
            : `${normalized}:${stat?.mtimeMs ?? 0}:${stat?.size ?? 0}`
        const state = event === 'unlink' ? `unlink:${now}` : `mtime:${stat?.mtimeMs ?? 0}`
        const statement = renderTemplate(channel.statement ?? '{event} {path}', {
          event,
          path: item.file,
          name,
          dir,
        })
        const facts = {
          event,
          path: item.file,
          name,
          dir,
          size: stat?.size,
          mtime: stat?.mtimeMs,
        }

        // 文件事件对每个线程都可能是关心的：线程自己用 match 筛选。
        for (const thread of context.threads) {
          context.emit({ thread: thread.id, statement, externalId, at: now, state, facts })
        }
      }
    },
  }
}

interface PendingFile {
  file: string
  eventType: string
}

function requireFsWatchChannel(channel: ChannelContext['channel']): FsWatchChannel {
  if (channel.kind !== 'fs-watch') throw new Error('fs-watch Channel 的配置不匹配')
  return channel
}

/** `rename` 既可能是新建也可能是删除，用「此刻是否存在」区分。 */
function resolveEvent(eventType: string, exists: boolean): FsEventKind {
  if (!exists) return 'unlink'
  return eventType === 'change' ? 'change' : 'add'
}

function readStat(path: string): { mtimeMs: number; size: number } | undefined {
  try {
    const stat = statSync(path)
    return stat.isFile() ? { mtimeMs: stat.mtimeMs, size: stat.size } : { mtimeMs: stat.mtimeMs, size: 0 }
  } catch {
    return undefined
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
