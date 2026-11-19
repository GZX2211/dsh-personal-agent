// tests/host/perception/channels/fs-watch.test.ts
//
// fs-watch 用真实文件系统验证：临时目录里写文件，等监听器把它变成候选。
// 断言落在「感知到了什么」上，不断言底层事件序列——各平台的原生事件不同。

import { mkdir, mkdtemp, rm, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FsWatchChannel, ThreadDefinition } from '../../../../src/shared/sources.ts'
import { createFsWatchChannel } from '../../../../src/host/perception/channels/fs-watch.ts'
import type { Candidate, ChannelContext } from '../../../../src/host/perception/types.ts'

let directory: string
let candidates: Candidate[]
let warnings: string[]
let stops: (() => void)[]

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'pa-fs-watch-'))
  candidates = []
  warnings = []
  stops = []
})

afterEach(async () => {
  for (const stop of stops.splice(0)) stop()
  await rm(directory, { recursive: true, force: true })
})

function context(channel: FsWatchChannel, threads?: ThreadDefinition[]): ChannelContext {
  return {
    sourceId: 'src-1',
    channel,
    threads: threads ?? [{ id: 'changes', name: '变更', enabled: true }],
    emit: candidate => candidates.push(candidate),
    warn: message => warnings.push(message),
  }
}

function start(channel: FsWatchChannel, threads?: ThreadDefinition[]): void {
  const runtime = createFsWatchChannel(context(channel, threads))
  stops.push(runtime.start())
}

function watchOf(overrides: Partial<FsWatchChannel> = {}): FsWatchChannel {
  return { kind: 'fs-watch', paths: [directory], debounceMs: 40, ...overrides }
}

async function settle(ms = 600): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, ms))
}

describe('fs-watch channel', () => {
  it('turns a file creation into a candidate', async () => {
    start(watchOf())

    await writeFile(join(directory, 'note.md'), 'hello', 'utf8')
    await vi.waitFor(() => expect(candidates.length).toBeGreaterThan(0), { timeout: 3_000, interval: 10 })

    const candidate = candidates[0]
    expect(candidate?.thread).toBe('changes')
    expect(candidate?.statement).toContain('note.md')
    expect(candidate?.externalId).toContain('note.md')
    expect(candidate?.facts).toMatchObject({ name: 'note.md', dir: directory })
    expect(['add', 'change']).toContain(candidate?.facts?.event)
  })

  it('produces one candidate per thread', async () => {
    start(
      watchOf(),
      [
        { id: 'changes', name: '变更', enabled: true },
        { id: 'docs', name: '文档', enabled: true },
      ],
    )

    await writeFile(join(directory, 'note.md'), 'hello', 'utf8')
    await vi.waitFor(() => expect(candidates.length).toBeGreaterThanOrEqual(2), { timeout: 3_000, interval: 10 })

    expect(new Set(candidates.map(candidate => candidate.thread))).toEqual(new Set(['changes', 'docs']))
  })

  it('ignores paths matched by the default ignore list', async () => {
    const nested = join(directory, 'node_modules')
    await mkdir(nested)
    start(watchOf({ recursive: true }))

    await writeFile(join(nested, 'dep.js'), 'x', 'utf8')
    await settle()

    expect(candidates).toEqual([])
  })

  it('ignores paths matched by a user pattern', async () => {
    start(watchOf({ ignore: ['**/*.log'] }))

    await writeFile(join(directory, 'a.log'), 'x', 'utf8')
    await settle()

    expect(candidates).toEqual([])
  })

  it('drops events the source did not ask for', async () => {
    start(watchOf({ events: ['unlink'] }))

    await writeFile(join(directory, 'note.md'), 'hello', 'utf8')
    await settle()

    expect(candidates).toEqual([])
  })

  it('reports a deletion as an unlink candidate', async () => {
    await writeFile(join(directory, 'gone.md'), 'x', 'utf8')
    start(watchOf({ events: ['unlink'] }))

    await unlink(join(directory, 'gone.md'))
    await vi.waitFor(() => expect(candidates.length).toBeGreaterThan(0), { timeout: 3_000, interval: 10 })

    expect(candidates[0]?.facts?.event).toBe('unlink')
    expect(candidates[0]?.externalId).toContain(':unlink:')
  })

  it('fails to start when the path does not exist', () => {
    const runtime = createFsWatchChannel(context(watchOf({ paths: [join(directory, 'missing')] })))

    expect(() => runtime.start()).toThrow(/路径不存在/)
  })

  it('stops producing candidates after stop', async () => {
    start(watchOf())
    for (const stop of stops.splice(0)) stop()

    await writeFile(join(directory, 'after-stop.md'), 'x', 'utf8')
    await settle()

    expect(candidates).toEqual([])
  })

  it('renders the statement template with the event facts', async () => {
    start(watchOf({ statement: '{event} {name}' }))

    await writeFile(join(directory, 'note.md'), 'hello', 'utf8')
    await vi.waitFor(() => expect(candidates.length).toBeGreaterThan(0), { timeout: 3_000, interval: 10 })

    expect(candidates[0]?.statement).toMatch(/^(add|change) note\.md$/)
  })

  it('merges a burst of writes into fewer candidates', async () => {
    start(watchOf({ debounceMs: 60 }))

    for (let index = 0; index < 3; index += 1) {
      await writeFile(join(directory, 'burst.md'), `v${index}`, 'utf8')
    }
    await settle()

    expect(candidates.length).toBeGreaterThan(0)
    expect(candidates.length).toBeLessThan(3)
  })

  it('watches nested files when recursive is on', async () => {
    const nested = join(directory, 'sub')
    await mkdir(nested)
    start(watchOf({ recursive: true }))

    await writeFile(join(nested, 'deep.md'), 'x', 'utf8')
    await vi.waitFor(() => expect(candidates.length).toBeGreaterThan(0), { timeout: 3_000, interval: 10 })

    expect(candidates[0]?.facts?.name).toBe('deep.md')
  })

  it('watches more than one path', async () => {
    const second = join(directory, 'second')
    await mkdir(second)
    start(watchOf({ paths: [directory, second] }))

    await writeFile(join(second, 'b.md'), 'x', 'utf8')
    await vi.waitFor(() => expect(candidates.some(candidate => candidate.facts?.dir === second)).toBe(true), {
      timeout: 3_000,
      interval: 10,
    })
  })
})
