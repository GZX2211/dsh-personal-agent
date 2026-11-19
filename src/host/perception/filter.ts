// src/host/perception/filter.ts
//
// 过滤判定：全部是代码层面的确定性事实，不做语义判断。
//
// 判定顺序有意义：线程开关最先（关掉的线程当它不存在），然后 match、去重、节流，
// 最后是 edge 状态。被 drop 的候选连记录都没有；被 filtered 的候选要记一条
// `delivered:false` 的信号——它是「事实到达了但没投递」的可解释证据。

import type { MatchExpr, ThreadDefinition } from '../../shared/sources.ts'
import { readPath } from './template.ts'
import type { Candidate } from './types.ts'

export type FilterVerdict =
  | { action: 'drop'; reason: 'thread-disabled' | 'duplicate' }
  | { action: 'filtered'; rule: 'match' | 'min-gap' | 'no-change' }
  | { action: 'deliver' }

export interface FilterInput {
  /** 线程定义；undefined 表示这条候选指向的线程不存在。 */
  thread: ThreadDefinition | undefined
  candidate: Candidate
  /** 当前时刻（毫秒）。 */
  now: number
  /** 该线程最近一次投递的时刻。 */
  lastDeliveredAt: number | undefined
  /** 该线程上次记录的 edge 状态。 */
  lastState: string | undefined
  /** 去重键是否已经出现过。 */
  seen: boolean
}

/** match 的取值域：渠道事实在下，候选自身的字段在上（后者优先）。 */
export function matchScope(candidate: Candidate): Record<string, unknown> {
  return {
    ...(candidate.facts ?? {}),
    thread: candidate.thread,
    statement: candidate.statement,
    externalId: candidate.externalId,
    at: candidate.at,
    state: candidate.state,
  }
}

/** 求值一条匹配表达式；任何取值或匹配失败都只意味着「不匹配」。 */
export function evaluateMatch(expr: MatchExpr, scope: Record<string, unknown>): boolean {
  if ('all' in expr) return expr.all.every(item => evaluateMatch(item, scope))
  if ('any' in expr) return expr.any.some(item => evaluateMatch(item, scope))
  if ('not' in expr) return !evaluateMatch(expr.not, scope)

  const actual = readPath(scope, expr.path)
  const expected = expr.value
  switch (expr.op) {
    case 'eq':
      return actual === expected
    case 'neq':
      return actual !== expected
    case 'contains':
      return typeof actual === 'string' && actual.includes(String(expected))
    case 'startsWith':
      return typeof actual === 'string' && actual.startsWith(String(expected))
    case 'endsWith':
      return typeof actual === 'string' && actual.endsWith(String(expected))
    case 'regex':
      return matchesRegExp(actual, String(expected))
    case 'in':
      return Array.isArray(expected) && expected.some(item => item === actual)
    case 'gt':
      return typeof actual === 'number' && typeof expected === 'number' && actual > expected
    case 'lt':
      return typeof actual === 'number' && typeof expected === 'number' && actual < expected
  }
}

export function judge(input: FilterInput): FilterVerdict {
  const { thread, candidate } = input

  // 1. 线程不在了或关掉了：当这条候选从未出现过。
  if (thread === undefined || !thread.enabled) return { action: 'drop', reason: 'thread-disabled' }

  // 2. 不匹配：事实成立但不该进 router，要留一条可解释的记录。
  if (thread.match !== undefined && !evaluateMatch(thread.match, matchScope(candidate))) {
    return { action: 'filtered', rule: 'match' }
  }

  // 3. 去重命中：同一份事实再到达一次不是新事实。
  if (input.seen) return { action: 'drop', reason: 'duplicate' }

  // 4. 节流：同一线程两条投递之间的最小间隔。
  const minGapMs = (thread.minGapSec ?? 0) * 1000
  if (minGapMs > 0 && input.lastDeliveredAt !== undefined && input.now - input.lastDeliveredAt < minGapMs) {
    return { action: 'filtered', rule: 'min-gap' }
  }

  // 5. edge：只在状态变化时投递。缺状态就无法比较，退化为 level。
  if (thread.mode === 'edge' && candidate.state !== undefined && candidate.state === input.lastState) {
    return { action: 'filtered', rule: 'no-change' }
  }

  return { action: 'deliver' }
}

function matchesRegExp(actual: unknown, pattern: string): boolean {
  if (typeof actual !== 'string') return false
  try {
    return new RegExp(pattern).test(actual)
  } catch {
    // 校验层已挡掉非法正则；这里只保证运行期不因一条坏表达式中断渠道。
    return false
  }
}
