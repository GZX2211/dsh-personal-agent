// tests/host/perception/validate.test.ts
//
// 来源定义的解析与校验：模型给的是自然语言参数，Host 必须把它收窄成确定的定义，
// 越界的数量、悬空的线程引用、无法执行的匹配表达式都在写入账本之前拒绝。

import { describe, expect, it } from 'vitest'
import { checkSourceDefinition, parseSourceInput } from '../../../src/host/perception/validate.ts'

function fsWatch(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: '本地文件',
    channel: { kind: 'fs-watch', paths: ['D:/tmp/a.txt'] },
    threads: [{ id: 'changes', name: '变更', enabled: true }],
    ...overrides,
  }
}

function errorsOf(raw: unknown, options?: { partial?: boolean }): string[] {
  const result = parseSourceInput(raw, options)
  return result.ok ? [] : result.errors
}

describe('parseSourceInput', () => {
  it('accepts a well-formed fs-watch source', () => {
    const result = parseSourceInput(fsWatch())

    expect(result).toEqual({
      ok: true,
      value: {
        name: '本地文件',
        channel: { kind: 'fs-watch', paths: ['D:/tmp/a.txt'] },
        threads: [{ id: 'changes', name: '变更', enabled: true }],
      },
    })
  })

  it('accepts a host-event source whose subscriptions name existing threads', () => {
    const result = parseSourceInput({
      name: '工单事件',
      channel: {
        kind: 'host-event',
        subscriptions: [{ event: 'task/closed', thread: 'tickets', statement: '工单 {payload.ticketId} 结束' }],
      },
      threads: [{ id: 'tickets', name: '工单', enabled: true }],
    })

    expect(result.ok).toBe(true)
  })

  it('keeps the script body out of the definition for the Host to write', () => {
    const result = parseSourceInput({
      name: '脚本来源',
      script: 'console.log("hi")',
      channel: { kind: 'script', command: 'node', args: ['watch.js'] },
      threads: [{ id: 'out', name: '输出', enabled: true }],
    })

    expect(result.ok && result.value.script).toBe('console.log("hi")')
    expect(result.ok && result.value.channel?.kind).toBe('script')
  })

  it('rejects a missing or unusable name', () => {
    expect(errorsOf(fsWatch({ name: '  ' }))).toContainEqual(expect.stringMatching(/name 不能为空/))
    expect(errorsOf(fsWatch({ name: '名'.repeat(61) }))).toContainEqual(expect.stringMatching(/最多 60/))
  })

  it('requires a channel and at least one thread when creating', () => {
    expect(errorsOf({ name: '缺东西' })).toEqual(
      expect.arrayContaining([expect.stringMatching(/channel/), expect.stringMatching(/线程/)]),
    )
  })

  it('allows a partial update', () => {
    expect(parseSourceInput({ name: '只改名' }, { partial: true })).toEqual({
      ok: true,
      value: { name: '只改名' },
    })
  })

  it('rejects an unknown channel kind', () => {
    expect(errorsOf(fsWatch({ channel: { kind: 'webhook' } }))).toContainEqual(expect.stringMatching(/channel/))
  })

  it('rejects more threads than the limit and duplicate thread ids', () => {
    const many = Array.from({ length: 9 }, (_, index) => ({ id: `t${index}`, name: `线${index}`, enabled: true }))
    expect(errorsOf(fsWatch({ threads: many }))).toContainEqual(expect.stringMatching(/最多 8/))

    expect(
      errorsOf(fsWatch({ threads: [{ id: 'a', name: '甲', enabled: true }, { id: 'a', name: '乙', enabled: true }] })),
    ).toContainEqual(expect.stringMatching(/重复/))
  })

  it('rejects a subscription that points at a thread the source does not own', () => {
    const errors = errorsOf({
      name: '悬空订阅',
      channel: { kind: 'host-event', subscriptions: [{ event: 'task/closed', thread: 'ghost', statement: 'x' }] },
      threads: [{ id: 'tickets', name: '工单', enabled: true }],
    })

    expect(errors).toContainEqual(expect.stringMatching(/ghost/))
  })

  it('rejects too many watch paths and too many ignore patterns', () => {
    expect(errorsOf(fsWatch({ channel: { kind: 'fs-watch', paths: Array.from({ length: 9 }, (_, i) => `D:/p/${i}`) } }))).toContainEqual(
      expect.stringMatching(/最多 8/),
    )
    expect(
      errorsOf(fsWatch({ channel: { kind: 'fs-watch', paths: ['D:/p'], ignore: Array.from({ length: 21 }, () => '**/*.tmp') } })),
    ).toContainEqual(expect.stringMatching(/最多 20/))
  })

  it('rejects an unusable match expression', () => {
    expect(
      errorsOf(
        fsWatch({
          threads: [{ id: 'a', name: '甲', enabled: true, match: { path: 'text', op: 'like', value: 'x' } }],
        }),
      ),
    ).toContainEqual(expect.stringMatching(/op/))
  })

  it('rejects a match value that does not fit its operator', () => {
    const base = { path: 'size', op: 'gt', value: 'big' }

    expect(errorsOf(fsWatch({ threads: [{ id: 'a', name: '甲', enabled: true, match: base }] }))).toContainEqual(
      expect.stringMatching(/value/),
    )
  })

  it('rejects a negative throttle and an unknown thread mode', () => {
    expect(
      errorsOf(fsWatch({ threads: [{ id: 'a', name: '甲', enabled: true, minGapSec: -1 }] })),
    ).toContainEqual(expect.stringMatching(/minGapSec/))
    expect(
      errorsOf(fsWatch({ threads: [{ id: 'a', name: '甲', enabled: true, mode: 'sometimes' }] })),
    ).toContainEqual(expect.stringMatching(/mode/))
  })

  it('rejects a script body above the size limit', () => {
    const errors = errorsOf({
      name: '大脚本',
      script: 'x'.repeat(64 * 1024 + 1),
      channel: { kind: 'script', command: 'node' },
      threads: [{ id: 'out', name: '输出', enabled: true }],
    })

    expect(errors).toContainEqual(expect.stringMatching(/64 KiB/))
  })

  it('reports every problem at once instead of stopping at the first', () => {
    const errors = errorsOf({
      name: '',
      channel: { kind: 'fs-watch', paths: [] },
      threads: [],
    })

    expect(errors.length).toBeGreaterThanOrEqual(3)
  })

  it('accepts nested all / any / not match expressions', () => {
    const match = {
      all: [
        { path: 'event', op: 'eq', value: 'change' },
        { any: [{ path: 'size', op: 'gt', value: 10 }, { not: { path: 'name', op: 'endsWith', value: '.tmp' } }] },
      ],
    }

    expect(parseSourceInput(fsWatch({ threads: [{ id: 'a', name: '甲', enabled: true, match }] })).ok).toBe(true)
  })

  it('rejects a script body when the channel is not a script channel', () => {
    expect(errorsOf(fsWatch({ script: 'console.log(1)' }))).toContainEqual(
      expect.stringMatching(/script 只能用于 script Channel/),
    )
  })

  it('updates only the enabled flag without touching the rest', () => {
    expect(parseSourceInput({ enabled: false }, { partial: true })).toEqual({
      ok: true,
      value: { enabled: false },
    })
  })
})

describe('checkSourceDefinition', () => {
  const base = {
    id: 'src-1',
    name: '本地文件',
    enabled: true,
    channel: { kind: 'fs-watch' as const, paths: ['D:/tmp/a.txt'] },
    threads: [{ id: 'changes', name: '变更', enabled: true }],
    createdAt: 1,
    updatedAt: 1,
  }

  it('accepts a definition that can be executed', () => {
    expect(checkSourceDefinition(base)).toEqual([])
  })

  it('reports a subscription that points outside the source', () => {
    const errors = checkSourceDefinition({
      ...base,
      channel: {
        kind: 'host-event',
        subscriptions: [{ event: 'task/closed', thread: 'ghost', statement: 'x' }],
      },
    })

    expect(errors).toContainEqual(expect.stringMatching(/ghost/))
  })

  it('reports a script path that escapes the state directory', () => {
    const errors = checkSourceDefinition({
      ...base,
      channel: { kind: 'script', command: 'node', scriptPath: '../../evil.js', scriptHash: 'abc' },
    })

    expect(errors).toContainEqual(expect.stringMatching(/越出状态目录/))
  })
})
