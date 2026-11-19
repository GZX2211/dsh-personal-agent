// src/host/perception/channels/script.ts
//
// script：跑一个常驻脚本，按行读它输出的 JSON 事实。
//
// 这是「外部服务 / 任意协议」的通用出口：脚本作者用自己的语言去轮询 HTTP、读进程
// 状态、连本地 socket，Host 只约定输出格式。脚本由 Host 落盘（router 没有写文件的
// 权限），启动前校验文件存在。

import { spawn, type ChildProcess } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import type { ScriptChannel } from '../../../shared/sources.ts'
import type { Candidate, ChannelContext, ChannelRuntime } from '../types.ts'

const DEFAULT_RESTART_DELAY_MS = 1_000
const MAX_RESTART_DELAY_MS = 60_000
/** 连续失败这么多次就认定脚本起不来，交给来源页的错误态。 */
const MAX_CONSECUTIVE_FAILURES = 10
/** 跑满这么久再崩，不算「连续失败」，计数从这一次重新开始。 */
const STABLE_RUN_MS = 60_000
const DEFAULT_KILL_TIMEOUT_MS = 5_000
/** 单行上限：再长也不像一条事实，多半是脚本打错了。 */
const MAX_LINE_BYTES = 16 * 1024
/** 每秒最多接受这么多行，防止脚本失控刷屏。 */
const MAX_LINES_PER_SECOND = 100
/** 连续这么多行解析失败，视为脚本异常并按失败策略处理。 */
const MAX_INVALID_STREAK = 20

export interface ScriptChannelDependencies {
  /** 状态目录：`scriptPath` 相对它解析。 */
  stateDirectory: string
  /** 重启退避基数；缺省 1000ms（测试注入更短的值）。 */
  restartDelayMs?: number
  /** 等待进程退出的上限；缺省 5000ms。 */
  killTimeoutMs?: number
}

export function createScriptChannel(
  context: ChannelContext,
  dependencies: ScriptChannelDependencies,
): ChannelRuntime {
  return {
    start() {
      const channel = requireScriptChannel(context.channel)
      const scriptFile = resolve(dependencies.stateDirectory, channel.scriptPath)
      if (!existsSync(scriptFile)) throw new Error(`脚本文件不存在：${scriptFile}`)

      const restarts = channel.restart ?? 'on-failure'
      const restartDelayMs = dependencies.restartDelayMs ?? DEFAULT_RESTART_DELAY_MS
      const killTimeoutMs = dependencies.killTimeoutMs ?? DEFAULT_KILL_TIMEOUT_MS
      const args = (channel.args ?? []).map(argument => argument.replaceAll('{script}', scriptFile))

      let stopped = false
      let failures = 0
      let invalidStreak = 0
      let receivedAt: number[] = []
      let child: ChildProcess | undefined
      let restartTimer: ReturnType<typeof setTimeout> | undefined
      let killTimer: ReturnType<typeof setTimeout> | undefined

      run()

      return () => {
        stopped = true
        if (restartTimer !== undefined) clearTimeout(restartTimer)
        stopProcess()
      }

      function run(): void {
        if (stopped) return
        let spawned: ChildProcess
        try {
          spawned = spawn(channel.command, args, {
            cwd: channel.cwd ?? dirname(scriptFile),
            env: { ...process.env, ...(channel.env ?? {}) },
            stdio: ['ignore', 'pipe', 'pipe'],
            windowsHide: true,
          })
        } catch (error) {
          scheduleRestart(`无法启动脚本：${describe(error)}`)
          return
        }
        child = spawned
        // 失败计数跨重启累积：它是「连续起不来」的证据，不能被每次重试清零。
        invalidStreak = 0
        receivedAt = []
        const startedAt = Date.now()

        let buffer = ''
        spawned.stdout?.setEncoding('utf8')
        spawned.stdout?.on('data', (chunk: string) => {
          buffer += chunk
          let newline = buffer.indexOf('\n')
          while (newline >= 0) {
            const line = buffer.slice(0, newline)
            buffer = buffer.slice(newline + 1)
            handleLine(line)
            newline = buffer.indexOf('\n')
          }
          if (buffer.length > MAX_LINE_BYTES) {
            // 超长行不等到换行：按上限切开处理，剩下的丢弃到下一个换行。
            handleLine(buffer.slice(0, MAX_LINE_BYTES))
            buffer = ''
          }
        })
        spawned.stderr?.setEncoding('utf8')
        spawned.stderr?.on('data', (chunk: string) => {
          const text = chunk.trim()
          if (text.length > 0) context.warn(`脚本 stderr：${text.slice(0, 500)}`)
        })
        spawned.on('error', error => {
          context.warn(`脚本进程错误：${describe(error)}`)
        })
        spawned.on('exit', (code, signal) => {
          child = undefined
          if (stopped) return
          // 正常结束不是失败：`on-failure` 只在异常退出时重启。
          if (code === 0) {
            context.warn(`脚本已退出（exit 0），不再重启：${channel.scriptPath}`)
            return
          }
          // 跑够久才崩说明它曾经正常工作，失败计数从这一次重新开始。
          if (Date.now() - startedAt >= STABLE_RUN_MS) failures = 0
          failures += 1
          if (restarts === 'never') {
            context.warn(`脚本已退出（${signal ?? code}），restart=never，不再重启`)
            return
          }
          if (failures > MAX_CONSECUTIVE_FAILURES) {
            context.warn(`脚本连续失败 ${failures} 次，已停止重启：${channel.scriptPath}`)
            return
          }
          scheduleRestart(`脚本已退出（${signal ?? code}），第 ${failures} 次重启`)
        })
      }

      function scheduleRestart(reason: string): void {
        if (stopped) return
        context.warn(reason)
        const delay = Math.min(MAX_RESTART_DELAY_MS, restartDelayMs * 2 ** Math.max(0, failures - 1))
        restartTimer = setTimeout(run, delay)
      }

      function handleLine(raw: string): void {
        if (stopped) return
        const line = raw.replace(/\r$/, '').trim()
        if (line.length === 0) return

        const now = Date.now()
        receivedAt = receivedAt.filter(time => now - time < 1_000)
        if (receivedAt.length >= MAX_LINES_PER_SECOND) {
          context.warn(`脚本输出超过每秒 ${MAX_LINES_PER_SECOND} 行的上限，已丢弃`)
          return
        }
        receivedAt.push(now)

        const candidate = parseLine(line)
        if (candidate === undefined) {
          invalidStreak += 1
          context.warn(`脚本输出了无法解析的一行：${line.slice(0, 200)}`)
          if (invalidStreak >= MAX_INVALID_STREAK) {
            context.warn('脚本连续输出非法行，按异常处理')
            invalidStreak = 0
            stopProcess()
          }
          return
        }
        invalidStreak = 0
        context.emit(candidate)
      }

      function stopProcess(): void {
        const running = child
        if (running === undefined || running.exitCode !== null) return
        const pid = running.pid
        running.kill()
        killTimer = setTimeout(() => {
          if (running.exitCode !== null) return
          forceKill(pid)
        }, killTimeoutMs)
        killTimer.unref?.()
      }
    },
  }
}

function requireScriptChannel(channel: ChannelContext['channel']): ScriptChannel {
  if (channel.kind !== 'script') throw new Error('script Channel 的配置不匹配')
  return channel
}

/**
 * 解析脚本输出的一行。
 *
 * 必填 `thread` 与 `statement`：没有线程归属就不知道给谁，没有陈述就没有事实。
 * `externalId` 缺省时用陈述的哈希——脚本作者不填也能得到稳定的去重键。
 */
function parseLine(line: string): Candidate | undefined {
  let parsed: unknown
  try {
    parsed = JSON.parse(line)
  } catch {
    return undefined
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return undefined

  const record = parsed as Record<string, unknown>
  if (typeof record.thread !== 'string' || record.thread.length === 0) return undefined
  if (typeof record.statement !== 'string' || record.statement.length === 0) return undefined

  const candidate: Candidate = {
    thread: record.thread,
    statement: record.statement,
    externalId:
      typeof record.externalId === 'string' && record.externalId.length > 0
        ? record.externalId
        : statementHash(record.statement),
    at: typeof record.at === 'number' && Number.isFinite(record.at) ? record.at : undefined,
  }
  if (typeof record.state === 'string') candidate.state = record.state
  return candidate
}

function statementHash(statement: string): string {
  return createHash('sha256').update(statement, 'utf8').digest('hex').slice(0, 16)
}

/** 五秒还没退出就强杀；Windows 需要连同子进程树一起清掉。 */
function forceKill(pid: number | undefined): void {
  if (pid === undefined) return
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true })
      return
    }
    process.kill(pid, 'SIGKILL')
  } catch {
    // 进程可能已经自己退出：强杀失败不需要额外处理。
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** 供装配层定位：脚本落盘根目录下的哪一层。 */
export function scriptDirectoryOf(stateDirectory: string, sourceId: string): string {
  return join(stateDirectory, 'perception', sourceId)
}
