// src/client/lib/signals.ts
//
// 事件页的纯展示逻辑：胶囊归属、结局、来源行与搜索。搜索覆盖卡片上看得见的
// 字段（事实、来源、线程、类型与结局），并与胶囊取交集。

import type { SignalKind } from '../../shared/events.ts'
import type { SignalView } from '../../shared/signals.ts'
import { shortTicketId } from '../../shared/tickets.ts'
import type { Dict, Translate } from '../i18n.ts'
import { matchesQuery, tokenizeQuery, type FilterContext } from './filter.ts'
import { formatTimestamp } from './format.ts'

/** 事件页第一层筛选：输入类型。 */
export type SignalKindFilter = 'all' | 'user' | 'timer' | 'perception'

/** 事件页第二层筛选：处理方式；`filtered` 对应来源层的忽略。 */
export type SignalVerdictFilter = 'all' | 'dispatch' | 'append' | 'reply' | 'filtered'

const KIND_FILTERS: Record<Exclude<SignalKindFilter, 'all'>, SignalKind> = {
  user: 'user-message',
  timer: 'timer',
  perception: 'perception',
}

export function matchesKindFilter(signal: SignalView, filter: SignalKindFilter): boolean {
  if (filter === 'all') return true
  return signal.kind === KIND_FILTERS[filter]
}

export function matchesVerdictFilter(signal: SignalView, filter: SignalVerdictFilter): boolean {
  if (filter === 'all') return true
  // 忽略只发生在来源层：有记录、没有决定。
  if (filter === 'filtered') return !signal.delivered
  return signal.delivered && signal.decision?.action === filter
}

/** 类型下拉的当前值文案。 */
export function kindFilterLabelKey(filter: SignalKindFilter): keyof Dict {
  switch (filter) {
    case 'all':
      return 'eventsKindAll'
    case 'user':
      return 'eventKindUser'
    case 'timer':
      return 'eventKindTimer'
    case 'perception':
      return 'eventKindPerception'
  }
}

/** 处理方式下拉的当前值文案。 */
export function verdictFilterLabelKey(filter: SignalVerdictFilter): keyof Dict {
  switch (filter) {
    case 'all':
      return 'eventsVerdictAll'
    case 'dispatch':
      return 'eventDispatch'
    case 'append':
      return 'eventAppend'
    case 'reply':
      return 'eventReply'
    case 'filtered':
      return 'eventsFilterIgnored'
  }
}

const KIND_KEYS: Record<SignalKind, keyof Dict> = {
  'user-message': 'eventKindUser',
  timer: 'eventKindTimer',
  perception: 'eventKindPerception',
}

export function signalKindKey(kind: SignalKind): keyof Dict {
  return KIND_KEYS[kind]
}

/** 一条信号的结局：过滤、待处理，或一种处理动作。 */
export type SignalVerdict =
  | { kind: 'pending' }
  | { kind: 'filtered'; rule?: string }
  | { kind: 'dispatch'; ticketId: string }
  | { kind: 'append'; ticketId: string }
  | { kind: 'reply'; inferred: boolean }

export function signalVerdict(signal: SignalView): SignalVerdict {
  if (!signal.delivered) {
    return signal.rule === undefined ? { kind: 'filtered' } : { kind: 'filtered', rule: signal.rule }
  }
  const decision = signal.decision
  if (decision === undefined) return { kind: 'pending' }
  switch (decision.action) {
    case 'dispatch':
      return { kind: 'dispatch', ticketId: decision.ticketId ?? '' }
    case 'append':
      return { kind: 'append', ticketId: decision.ticketId ?? '' }
    case 'reply':
      return { kind: 'reply', inferred: decision.inferred === true }
  }
}

const VERDICT_KEYS: Record<SignalVerdict['kind'], keyof Dict> = {
  pending: 'eventPending',
  filtered: 'eventFiltered',
  dispatch: 'eventDispatch',
  append: 'eventAppend',
  reply: 'eventReply',
}

export function verdictLabelKey(verdict: SignalVerdict): keyof Dict {
  return VERDICT_KEYS[verdict.kind]
}

/** 结局徽标的完整文案：工单用短码，被过滤时附上命中的规则。 */
export function verdictText(t: Translate, verdict: SignalVerdict): string {
  switch (verdict.kind) {
    case 'pending':
      return t('eventPending')
    case 'filtered': {
      const rule = ruleKey(verdict.rule)
      return rule === undefined ? t('eventFiltered') : `${t('eventFiltered')} · ${t(rule)}`
    }
    case 'dispatch':
      return verdict.ticketId.length === 0
        ? t('eventDispatch')
        : `${t('eventDispatch')} #${shortTicketId(verdict.ticketId)}`
    case 'append':
      return verdict.ticketId.length === 0
        ? t('eventAppend')
        : `${t('eventAppend')} #${shortTicketId(verdict.ticketId)}`
    case 'reply':
      return t('eventReply')
  }
}

const RULE_KEYS: Record<string, keyof Dict> = {
  match: 'eventRuleMatch',
  'min-gap': 'eventRuleMinGap',
  'no-change': 'eventRuleNoChange',
}

/** 过滤规则 → 词典键；未知规则不编造解释。 */
export function ruleKey(rule: string | undefined): keyof Dict | undefined {
  return rule === undefined ? undefined : RULE_KEYS[rule]
}

/** 来源行：用户消息来自「对话」，感知消息来自「来源 · 线程」。 */
export function signalSourceText(t: Translate, signal: SignalView): string {
  if (signal.kind === 'user-message') return t('eventSourceConversation')
  return [signal.sourceName, signal.threadName].filter(part => part !== undefined && part.length > 0).join(' · ')
}

/** 卡片上能看到的字段都参与搜索：事实、来源、线程、类型、结局与时间。 */
export function signalHaystack(signal: SignalView, ctx: FilterContext): string {
  const parts: string[] = [
    signal.text,
    signal.sourceName ?? '',
    signal.threadName ?? '',
    ctx.t(signalKindKey(signal.kind)),
    ctx.t(verdictLabelKey(signalVerdict(signal))),
  ]
  const rule = signal.rule === undefined ? undefined : ruleKey(signal.rule)
  if (rule !== undefined) parts.push(ctx.t(rule))
  parts.push(formatTimestamp(ctx.language, signal.receivedAt))
  return parts.join(' ').toLowerCase()
}

export function filterSignals(
  signals: readonly SignalView[],
  kind: SignalKindFilter,
  verdict: SignalVerdictFilter,
  query: string,
  ctx: FilterContext,
): SignalView[] {
  const tokens = tokenizeQuery(query)
  return signals.filter(
    signal =>
      matchesKindFilter(signal, kind) &&
      matchesVerdictFilter(signal, verdict) &&
      matchesQuery(signalHaystack(signal, ctx), tokens),
  )
}

/**
 * 空态文案：先区分「历史还在检索」「搜索没命中」，再按处理方式、类型说清哪一层空。
 *
 * 处理方式比类型更具体，因此组合筛选为空时优先说处理方式。
 */
export function signalEmptyKey(
  kind: SignalKindFilter,
  verdict: SignalVerdictFilter,
  searching: boolean,
  loading: boolean,
): keyof Dict {
  if (searching) return loading ? 'eventsSearching' : 'eventsNoMatch'
  switch (verdict) {
    case 'filtered':
      return 'eventsEmptyFiltered'
    case 'dispatch':
      return 'eventsEmptyDispatch'
    case 'append':
      return 'eventsEmptyAppend'
    case 'reply':
      return 'eventsEmptyReply'
    case 'all':
      break
  }
  switch (kind) {
    case 'user':
      return 'eventsEmptyUser'
    case 'timer':
      return 'eventsEmptyTimer'
    case 'perception':
      return 'eventsEmptyPerception'
    case 'all':
      return 'eventsEmptyAll'
  }
}
