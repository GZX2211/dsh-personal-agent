// src/host/projector/signal-query.ts
//
// 信号投影的累加规则与历史检索。
//
// 投影只保留最近一段进入快照（SIGNAL_VIEW_LIMIT），但「最近一段」是展示口径，
// 不是事实边界：事件页的搜索要能翻到更早的账本事实，因此全量折叠与截断分开成
// 两件事——折叠在这里，展示多少由调用方决定。

import type { SignalQuery, SignalQueryResponse } from '../../shared/api.ts'
import { clampSignalLimit, SIGNAL_QUERY_LIMIT } from '../../shared/api.ts'
import type { L2Event, SignalKind } from '../../shared/events.ts'
import type { SignalDecisionView, SignalView } from '../../shared/signals.ts'

export interface SignalAccumulator {
  signalId: string
  kind: SignalKind
  receivedAt: number
  delivered: boolean
  rule?: string
  sourceId?: string
  sourceName?: string
  threadId?: string
  threadName?: string
  externalId?: string
  text: string
  messageId?: string
  decision?: SignalDecisionView
  /** 决定所属的账本序号：同一信号被记了多条决定时，后写的赢。 */
  decisionSeq?: number
}

/** 折叠一条信号域事件；其它事件类型原样忽略。 */
export function applySignalEvent(
  signals: Map<string, SignalAccumulator>,
  event: L2Event,
): void {
  switch (event.type) {
    case 'signal/received': {
      // 同一 signalId 只建立一次：重放的同一条事实不改写已记录的身份与时刻。
      if (signals.has(event.payload.signalId)) return
      signals.set(event.payload.signalId, {
        signalId: event.payload.signalId,
        kind: event.payload.kind,
        receivedAt: event.payload.receivedAt,
        delivered: event.payload.delivered,
        rule: event.payload.rule,
        sourceId: event.payload.sourceId,
        sourceName: event.payload.sourceName,
        threadId: event.payload.threadId,
        threadName: event.payload.threadName,
        externalId: event.payload.externalId,
        text: event.payload.text ?? '',
        messageId: event.payload.messageId,
      })
      return
    }
    case 'decision/recorded': {
      const signal = signals.get(event.payload.signalId)
      // 没有信号的决定是孤儿：它解释不了任何一次输入，投影不凭空造一条信号。
      if (signal === undefined) return
      if (signal.decisionSeq !== undefined && signal.decisionSeq > event.seq) return
      signal.decision = {
        action: event.payload.action,
        ...(event.payload.ticketId === undefined ? {} : { ticketId: event.payload.ticketId }),
        ...(event.payload.inferred === undefined ? {} : { inferred: event.payload.inferred }),
        at: event.time,
      }
      signal.decisionSeq = event.seq
      return
    }
  }
}

/**
 * 视图排序：先按到达时刻倒序，同一时刻按 id 倒序。
 *
 * 时刻可能相同（同一批观察），此时顺序必须仍然确定，否则列表会在两次轮询间抖动。
 */
export function toSignalViews(
  signals: ReadonlyMap<string, SignalAccumulator>,
  limit = Number.POSITIVE_INFINITY,
): SignalView[] {
  return [...signals.values()]
    .sort(
      (left, right) =>
        right.receivedAt - left.receivedAt || right.signalId.localeCompare(left.signalId),
    )
    .slice(0, limit)
    .map(toSignalView)
}

function toSignalView(signal: SignalAccumulator): SignalView {
  const view: SignalView = {
    signalId: signal.signalId,
    kind: signal.kind,
    receivedAt: signal.receivedAt,
    delivered: signal.delivered,
    text: signal.text,
  }
  if (signal.rule !== undefined) view.rule = signal.rule
  if (signal.sourceId !== undefined) view.sourceId = signal.sourceId
  if (signal.sourceName !== undefined) view.sourceName = signal.sourceName
  if (signal.threadId !== undefined) view.threadId = signal.threadId
  if (signal.threadName !== undefined) view.threadName = signal.threadName
  if (signal.externalId !== undefined) view.externalId = signal.externalId
  if (signal.messageId !== undefined) view.messageId = signal.messageId
  if (signal.decision !== undefined) view.decision = signal.decision
  return view
}

/**
 * 在已投影的视图里检索。
 *
 * `total` 是匹配总数，`signals` 只是其中最多 `limit` 条：界面据此说明「还有多少
 * 历史没展示」，而不是把截断误报成全部。
 */
export function querySignals(
  views: readonly SignalView[],
  query: SignalQuery,
): SignalQueryResponse {
  const tokens = tokenize(query.q)
  const matched =
    tokens.length === 0
      ? [...views]
      : views.filter(view => matchesAll(haystackOf(view), tokens))
  const limit = clampSignalLimit(query.limit ?? SIGNAL_QUERY_LIMIT.default)
  return { signals: matched.slice(0, limit), total: matched.length }
}

function tokenize(query: string | undefined): string[] {
  return (query ?? '')
    .toLowerCase()
    .split(/\s+/)
    .filter(token => token.length > 0)
}

/** 展示层可见的三个字段：事实文本、来源名与线程名。 */
function haystackOf(view: SignalView): string {
  return [view.text, view.sourceName ?? '', view.threadName ?? ''].join(' ').toLowerCase()
}

function matchesAll(haystack: string, tokens: readonly string[]): boolean {
  return tokens.every(token => haystack.includes(token))
}
