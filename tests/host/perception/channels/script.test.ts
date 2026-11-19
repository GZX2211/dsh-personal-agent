// tests/host/perception/channels/script.test.ts
//
// script 渠道用真实子进程验证：临时脚本输出 JSON 行，渠道把它变成候选。
// 覆盖行协议、非法行、速率限制、退出与重启、以及停止时的进程回收。

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ScriptChannel } from '../../../../src/shared/sources.ts'
import { createScriptChannel } from '../../../../src/host/perception/channels/script.ts'
import type { Candidate, ChannelContext } from '../../../../src/host/perception/types.ts'

const SCRIPT_RELATIVE = 'perception/test/emit.js'

let directory: string
let candidates: Candidate[]
let warnings: string[]
let stops: (() => void)[]

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'pa-script-'))
  candidates = []
  warnings = []
  stops = []
})

afterEach(async () => {
  for (const stop of stops.splice(0)) stop()
  // 子进程收到 kill 之后还要一点时间才释放文件句柄；Windows 上尤其明显。
  await new Promise(resolve => setTimeout(resolve, 250))
  await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
})

async function writeScript(body: string): Promise<void> {
  await mkdir(join(directory, 'perception/test'), { recursive: true })
  await writeFile(join(directory, SCRIPT_RELATIVE), body, 'utf8')
}

function context(): ChannelContext {
  return {
    sourceId: 'src-1',
    channel: channelOf(),
    threads: [{ id: 'out', name: '输出', enabled: true }],
    emit: candidate => candidates.push(candidate),
    warn: message => warnings.push(message),
  }
}

function channelOf(overrides: Partial<ScriptChannel> = {}): ScriptChannel {
  return {
    kind: 'script',
    command: process.execPath,
    args: ['{script}'],
    scriptPath: SCRIPT_RELATIVE,
    scriptHash: 'unused',
    ...overrides,
  }
}

function start(overrides: Partial<ScriptChannel> = {}, options: { restartDelayMs?: number } = {}): void {
  const ctx: ChannelContext = { ...context(), channel: channelOf(overrides) }
  const runtime = createScriptChannel(ctx, {
    stateDirectory: directory,
    restartDelayMs: options.restartDelayMs ?? 20,
    killTimeoutMs: 200,
  })
  stops.push(runtime.start())
}

async function waitForCandidates(count: number): Promise<void> {
  await vi.waitFor(() => expect(candidates.length).toBeGreaterThanOrEqual(count), { timeout: 5_000, interval: 20 })
}

describe('script channel', () => {
  it('turns a JSON line into a candidate', async () => {
    await writeScript('console.log(JSON.stringify({ thread: "out", statement: "服务返回 500" }))\n')
    start()

    await waitForCandidates(1)

    expect(candidates[0]).toMatchObject({ thread: 'out', statement: '服务返回 500' })
    expect(candidates[0]?.externalId).toMatch(/^[0-9a-f]{16}$/)
  })

  it('keeps the externalId the script supplied', async () => {
    await writeScript(
      'console.log(JSON.stringify({ thread: "out", statement: "新版本", externalId: "v1.2.3", state: "mtime:3" }))\n',
    )
    start()

    await waitForCandidates(1)

    expect(candidates[0]).toMatchObject({ externalId: 'v1.2.3', state: 'mtime:3' })
  })

  it('replaces the {script} placeholder with the absolute script path', async () => {
    await writeScript('console.log(JSON.stringify({ thread: "out", statement: process.argv[1] }))\n')
    start()

    await waitForCandidates(1)

    expect(candidates[0]?.statement.endsWith('emit.js')).toBe(true)
  })

  it('drops lines that are not usable facts and warns', async () => {
    await writeScript(
      [
        'console.log("不是 JSON")',
        'console.log(JSON.stringify({ thread: "out" }))',
        'console.log(JSON.stringify({ thread: "out", statement: "有效的一条" }))',
        '',
      ].join('\n'),
    )
    start()

    await waitForCandidates(1)

    expect(candidates).toHaveLength(1)
    expect(candidates[0]?.statement).toBe('有效的一条')
    expect(warnings.some(message => message.includes('无法解析'))).toBe(true)
  })

  it('stops accepting output after the rate limit', async () => {
    await writeScript(
      'for (let i = 0; i < 150; i += 1) console.log(JSON.stringify({ thread: "out", statement: `第 ${i} 条` }))\n',
    )
    start()

    await vi.waitFor(() => expect(warnings.some(message => message.includes('上限'))).toBe(true), {
      timeout: 5_000,
      interval: 20,
    })
    expect(candidates.length).toBeLessThanOrEqual(100)
  })

  it('fails to start when the script file is missing', () => {
    const runtime = createScriptChannel(context(), { stateDirectory: directory })

    expect(() => runtime.start()).toThrow(/脚本文件不存在/)
  })

  it('stops the process when the source stops', async () => {
    await writeScript(
      'setInterval(() => console.log(JSON.stringify({ thread: "out", statement: "tick" })), 20)\n',
    )
    start()
    await waitForCandidates(1)

    for (const stop of stops.splice(0)) stop()
    const seen = candidates.length
    await new Promise(resolve => setTimeout(resolve, 200))

    expect(candidates.length).toBe(seen)
  })

  it('does not restart a script that exits cleanly under on-failure', async () => {
    await writeScript('console.log(JSON.stringify({ thread: "out", statement: "只跑一次" }))\n')
    start({ restart: 'on-failure' })

    await waitForCandidates(1)
    await new Promise(resolve => setTimeout(resolve, 200))

    expect(candidates).toHaveLength(1)
    expect(warnings.some(message => message.includes('不再重启'))).toBe(true)
  })

  it('never restarts when the policy says never', async () => {
    await writeScript('process.exit(1)\n')
    start({ restart: 'never' })

    await vi.waitFor(() => expect(warnings.some(message => message.includes('restart=never'))).toBe(true), {
      timeout: 5_000,
      interval: 20,
    })
  })

  it('passes at through and applies the configured environment', async () => {
    await writeScript(
      'console.log(JSON.stringify({ thread: "out", statement: process.env.PA_TEST, at: 1234 }))\n',
    )
    start({ env: { PA_TEST: '来自环境' } })

    await waitForCandidates(1)

    expect(candidates[0]).toMatchObject({ statement: '来自环境', at: 1234 })
  })

  it('does not buffer an absurdly long line forever', async () => {
    await writeScript('process.stdout.write("x".repeat(32 * 1024))\n')
    start()

    await vi.waitFor(() => expect(warnings.some(message => message.includes('无法解析'))).toBe(true), {
      timeout: 5_000,
      interval: 20,
    })
    expect(candidates).toEqual([])
  })

  it(
    'restarts a failing script and eventually gives up',
    async () => {
      await writeScript('process.exit(3)\n')
      // 退避基数压到 1ms：验证的是「会重试、也有上限」，不是真实退避时长。
      start({ restart: 'on-failure' }, { restartDelayMs: 1 })

      await vi.waitFor(() => expect(warnings.some(message => message.includes('已停止重启'))).toBe(true), {
        timeout: 15_000,
        interval: 50,
      })
      expect(warnings.filter(message => message.includes('次重启')).length).toBeGreaterThan(0)
    },
    20_000,
  )
})
