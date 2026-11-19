// tests/host/perception/filter.test.ts
//
// 过滤是确定性判定：线程开关、match、去重、节流、edge 状态，全部是代码层面的事实，
// 不做任何语义判断——「要不要管这条事实」留给 router。

import { describe, expect, it } from 'vitest'
import type { MatchExpr, ThreadDefinition } from '../../../src/shared/sources.ts'
import { evaluateMatch, judge, type FilterInput } from '../../../src/host/perception/filter.ts'
import type { Candidate } from '../../../src/host/perception/types.ts'

function thread(overrides: Partial<ThreadDefinition> = {}): ThreadDefinition {
  return { id: 'changes', name: '变更', enabled: true, ...overrides }
}

function candidate(overrides: Partial<Candidate> = {}): Candidate {
  return { thread: 'changes', statement: '文件被修改', ...overrides }
}

function input(overrides: Partial<FilterInput> = {}): FilterInput {
  return {
    thread: thread(),
    candidate: candidate(),
    now: 1_000_000,
    lastDeliveredAt: undefined,
    lastState: undefined,
    seen: false,
    ...overrides,
  }
}

describe('evaluateMatch', () => {
  const scope = { event: 'change', path: 'D:/tmp/a.txt', size: 12, name: 'a.txt' }

  it('compares with eq and neq', () => {
    expect(evaluateMatch({ path: 'event', op: 'eq', value: 'change' }, scope)).toBe(true)
    expect(evaluateMatch({ path: 'event', op: 'neq', value: 'add' }, scope)).toBe(true)
    expect(evaluateMatch({ path: 'event', op: 'eq', value: 'add' }, scope)).toBe(false)
  })

  it('matches substrings and affixes', () => {
    expect(evaluateMatch({ path: 'path', op: 'contains', value: 'tmp' }, scope)).toBe(true)
    expect(evaluateMatch({ path: 'name', op: 'startsWith', value: 'a.' }, scope)).toBe(true)
    expect(evaluateMatch({ path: 'name', op: 'endsWith', value: '.txt' }, scope)).toBe(true)
    expect(evaluateMatch({ path: 'name', op: 'endsWith', value: '.md' }, scope)).toBe(false)
  })

  it('matches a regular expression', () => {
    expect(evaluateMatch({ path: 'path', op: 'regex', value: '\\.txt$' }, scope)).toBe(true)
    expect(evaluateMatch({ path: 'path', op: 'regex', value: '\\.md$' }, scope)).toBe(false)
  })

  it('matches membership in a list', () => {
    expect(evaluateMatch({ path: 'event', op: 'in', value: ['add', 'change'] }, scope)).toBe(true)
    expect(evaluateMatch({ path: 'event', op: 'in', value: ['unlink'] }, scope)).toBe(false)
  })

  it('compares numbers with gt and lt', () => {
    expect(evaluateMatch({ path: 'size', op: 'gt', value: 10 }, scope)).toBe(true)
    expect(evaluateMatch({ path: 'size', op: 'lt', value: 10 }, scope)).toBe(false)
    expect(evaluateMatch({ path: 'event', op: 'gt', value: 1 }, scope)).toBe(false)
  })

  it('combines with all, any and not', () => {
    const change: MatchExpr = { path: 'event', op: 'eq', value: 'change' }
    const big: MatchExpr = { path: 'size', op: 'gt', value: 100 }

    expect(evaluateMatch({ all: [change, big] }, scope)).toBe(false)
    expect(evaluateMatch({ any: [change, big] }, scope)).toBe(true)
    expect(evaluateMatch({ not: change }, scope)).toBe(false)
  })

  it('treats a missing field as unequal and otherwise unmatched', () => {
    expect(evaluateMatch({ path: 'ghost', op: 'eq', value: 'x' }, scope)).toBe(false)
    expect(evaluateMatch({ path: 'ghost', op: 'neq', value: 'x' }, scope)).toBe(true)
    expect(evaluateMatch({ path: 'ghost', op: 'contains', value: 'x' }, scope)).toBe(false)
  })

  it('does not throw on a broken expression', () => {
    // 校验层挡掉了非法正则；运行时即便遇到也只会判为不匹配，而不是让渠道崩掉。
    expect(evaluateMatch({ path: 'path', op: 'regex', value: '(' }, scope)).toBe(false)
  })
})

describe('judge', () => {
  it('drops a candidate whose thread is unknown', () => {
    expect(judge(input({ thread: undefined }))).toEqual({ action: 'drop', reason: 'thread-disabled' })
  })

  it('drops a candidate whose thread is switched off', () => {
    expect(judge(input({ thread: thread({ enabled: false }) }))).toEqual({
      action: 'drop',
      reason: 'thread-disabled',
    })
  })

  it('filters a candidate that does not match', () => {
    const verdict = judge(
      input({ thread: thread({ match: { path: 'event', op: 'eq', value: 'add' } }), candidate: candidate() }),
    )

    expect(verdict).toEqual({ action: 'filtered', rule: 'match' })
  })

  it('drops a candidate that was already seen', () => {
    expect(judge(input({ seen: true }))).toEqual({ action: 'drop', reason: 'duplicate' })
  })

  it('filters a candidate inside the throttle window', () => {
    const verdict = judge(input({ thread: thread({ minGapSec: 60 }), now: 1_000_000, lastDeliveredAt: 970_000 }))

    expect(verdict).toEqual({ action: 'filtered', rule: 'min-gap' })
  })

  it('delivers once the throttle window has passed', () => {
    const verdict = judge(input({ thread: thread({ minGapSec: 60 }), now: 1_000_000, lastDeliveredAt: 940_000 }))

    expect(verdict).toEqual({ action: 'deliver' })
  })

  it('delivers the first candidate of a throttled thread', () => {
    expect(judge(input({ thread: thread({ minGapSec: 60 }) }))).toEqual({ action: 'deliver' })
  })

  it('filters an edge candidate whose state did not change', () => {
    const verdict = judge(
      input({
        thread: thread({ mode: 'edge' }),
        candidate: candidate({ state: 'mtime:1' }),
        lastState: 'mtime:1',
      }),
    )

    expect(verdict).toEqual({ action: 'filtered', rule: 'no-change' })
  })

  it('delivers an edge candidate whose state changed', () => {
    const verdict = judge(
      input({
        thread: thread({ mode: 'edge' }),
        candidate: candidate({ state: 'mtime:2' }),
        lastState: 'mtime:1',
      }),
    )

    expect(verdict).toEqual({ action: 'deliver' })
  })

  it('delivers an edge candidate that carries no state', () => {
    // 渠道没给状态就无法比较：退化为 level，而不是永远拦住。
    expect(judge(input({ thread: thread({ mode: 'edge' }), lastState: 'mtime:1' }))).toEqual({
      action: 'deliver',
    })
  })

  it('delivers every level candidate that passes the other rules', () => {
    expect(judge(input({ thread: thread({ mode: 'level' }), lastState: 'mtime:1' }))).toEqual({
      action: 'deliver',
    })
  })

  it('checks the switch before everything else', () => {
    const verdict = judge(
      input({ thread: thread({ enabled: false, minGapSec: 1 }), candidate: candidate({ state: 'x' }) }),
    )

    expect(verdict).toEqual({ action: 'drop', reason: 'thread-disabled' })
  })

  it('matches against the facts a channel supplied', () => {
    const verdict = judge(
      input({
        thread: thread({ match: { path: 'path', op: 'endsWith', value: '.md' } }),
        candidate: candidate({ facts: { path: 'D:/docs/readme.md' } }),
      }),
    )

    expect(verdict).toEqual({ action: 'deliver' })
  })

  it('lets candidate fields win over equally named facts', () => {
    // 渠道事实不能顶替候选自身的归属字段。
    const verdict = judge(
      input({
        thread: thread({ match: { path: 'thread', op: 'eq', value: 'changes' } }),
        candidate: candidate({ facts: { thread: 'other' } }),
      }),
    )

    expect(verdict).toEqual({ action: 'deliver' })
  })

  it('filters one millisecond inside the throttle window', () => {
    const verdict = judge(input({ thread: thread({ minGapSec: 60 }), now: 1_000_000, lastDeliveredAt: 940_001 }))

    expect(verdict).toEqual({ action: 'filtered', rule: 'min-gap' })
  })
})
