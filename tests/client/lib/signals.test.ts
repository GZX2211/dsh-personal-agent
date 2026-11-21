// tests/client/lib/signals.test.ts
//
// 事件页的纯逻辑：双筛（事件类型 + 处理方式）、搜索、结局与来源行。
// 断言落在用户读到的语义上。

import { describe, expect, it } from 'vitest'
import type { SignalView } from '../../../src/shared/signals.ts'
import { translateFor } from '../../../src/client/i18n.ts'
import {
  filterSignals,
  kindFilterLabelKey,
  matchesKindFilter,
  matchesVerdictFilter,
  ruleKey,
  signalEmptyKey,
  signalHaystack,
  signalKindKey,
  signalSourceText,
  signalVerdict,
  verdictFilterLabelKey,
  verdictLabelKey,
  verdictText,
} from '../../../src/client/lib/signals.ts'

const t = translateFor('zh')
const NOW = 1_700_000_000_000
const ctx = { t, language: 'zh' }

function signal(overrides: Partial<SignalView> = {}): SignalView {
  return {
    signalId: 's-aaaaaaaaaa',
    kind: 'perception',
    receivedAt: NOW,
    delivered: true,
    text: 'app.yml 被修改',
    ...overrides,
  }
}

describe('kind filter', () => {
  it('selects by signal kind', () => {
    expect(matchesKindFilter(signal({ kind: 'user-message' }), 'user')).toBe(true)
    expect(matchesKindFilter(signal({ kind: 'timer' }), 'timer')).toBe(true)
    expect(matchesKindFilter(signal({ kind: 'perception' }), 'perception')).toBe(true)
    expect(matchesKindFilter(signal({ kind: 'perception' }), 'user')).toBe(false)
  })

  it('keeps everything under all', () => {
    expect(matchesKindFilter(signal({ kind: 'timer' }), 'all')).toBe(true)
  })
})

describe('verdict filter', () => {
  it('selects a delivered decision by its action', () => {
    expect(
      matchesVerdictFilter(signal({ decision: { action: 'dispatch', ticketId: 't-1', at: NOW } }), 'dispatch'),
    ).toBe(true)
    expect(
      matchesVerdictFilter(signal({ decision: { action: 'append', ticketId: 't-1', at: NOW } }), 'append'),
    ).toBe(true)
    expect(
      matchesVerdictFilter(signal({ decision: { action: 'reply', inferred: true, at: NOW } }), 'reply'),
    ).toBe(true)
    expect(
      matchesVerdictFilter(signal({ decision: { action: 'supplement', ticketId: 't-1', at: NOW } }), 'supplement'),
    ).toBe(true)
    expect(
      matchesVerdictFilter(signal({ decision: { action: 'reply', at: NOW } }), 'dispatch'),
    ).toBe(false)
  })

  it('treats an undelivered signal as ignored', () => {
    expect(matchesVerdictFilter(signal({ delivered: false, rule: 'min-gap' }), 'filtered')).toBe(true)
    expect(matchesVerdictFilter(signal({ delivered: true }), 'filtered')).toBe(false)
    // 被过滤的信号没有决定，因此不属于任何处理动作。
    expect(matchesVerdictFilter(signal({ delivered: false }), 'reply')).toBe(false)
  })

  it('keeps everything under all', () => {
    expect(matchesVerdictFilter(signal({ delivered: false }), 'all')).toBe(true)
    expect(matchesVerdictFilter(signal(), 'all')).toBe(true)
  })
})

describe('kind labels', () => {
  it('maps every kind to a localized label', () => {
    expect(t(signalKindKey('user-message'))).toBe('用户')
    expect(t(signalKindKey('timer'))).toBe('定时')
    expect(t(signalKindKey('perception'))).toBe('感知')
  })

  it('labels every dropdown value', () => {
    expect(t(kindFilterLabelKey('all'))).toBe('全部类型')
    expect(t(kindFilterLabelKey('user'))).toBe('用户')
    expect(t(kindFilterLabelKey('timer'))).toBe('定时')
    expect(t(kindFilterLabelKey('perception'))).toBe('感知')
    expect(t(verdictFilterLabelKey('all'))).toBe('全部处理')
    expect(t(verdictFilterLabelKey('dispatch'))).toBe('派发')
    expect(t(verdictFilterLabelKey('append'))).toBe('追加')
    expect(t(verdictFilterLabelKey('supplement'))).toBe('补充')
    expect(t(verdictFilterLabelKey('reply'))).toBe('响应')
    expect(t(verdictFilterLabelKey('filtered'))).toBe('忽略（过滤）')
  })
})

describe('verdict', () => {
  it('is pending while the signal has no decision', () => {
    const verdict = signalVerdict(signal())

    expect(verdict).toEqual({ kind: 'pending' })
    expect(t(verdictLabelKey(verdict))).toBe('待处理')
  })

  it('carries the matched rule of an undelivered signal', () => {
    const verdict = signalVerdict(signal({ delivered: false, rule: 'min-gap' }))

    expect(verdict).toEqual({ kind: 'filtered', rule: 'min-gap' })
    expect(ruleKey('min-gap')).toBe('eventRuleMinGap')
    expect(ruleKey('match')).toBe('eventRuleMatch')
    expect(ruleKey('no-change')).toBe('eventRuleNoChange')
    expect(ruleKey('unknown-rule')).toBeUndefined()
  })

  it('carries the ticket of a dispatch or append decision', () => {
    const dispatch = signalVerdict(
      signal({ decision: { action: 'dispatch', ticketId: 't-1', at: NOW } }),
    )
    const append = signalVerdict(signal({ decision: { action: 'append', ticketId: 't-2', at: NOW } }))

    expect(dispatch).toEqual({ kind: 'dispatch', ticketId: 't-1' })
    expect(append).toEqual({ kind: 'append', ticketId: 't-2' })
    expect(t(verdictLabelKey(dispatch))).toBe('派发')
  })

  it('carries the ticket a supplement was delivered to', () => {
    const supplement = signalVerdict(
      signal({ decision: { action: 'supplement', ticketId: 't-3', at: NOW } }),
    )

    expect(supplement).toEqual({ kind: 'supplement', ticketId: 't-3' })
    expect(t(verdictLabelKey(supplement))).toBe('补充')
  })

  it('marks an inferred reply', () => {
    const verdict = signalVerdict(
      signal({ decision: { action: 'reply', inferred: true, at: NOW } }),
    )

    expect(verdict).toEqual({ kind: 'reply', inferred: true })
    expect(t(verdictLabelKey(verdict))).toBe('响应')
  })

  it('renders the badged copy including the ticket short id and the rule', () => {
    expect(verdictText(t, { kind: 'pending' })).toBe('待处理')
    expect(verdictText(t, { kind: 'reply', inferred: false })).toBe('响应')
    expect(verdictText(t, { kind: 'dispatch', ticketId: 't-9c20e78bca' })).toBe('派发 #9c20e7')
    expect(verdictText(t, { kind: 'append', ticketId: 't-9c20e78bca' })).toBe('追加 #9c20e7')
    expect(verdictText(t, { kind: 'supplement', ticketId: 't-9c20e78bca' })).toBe('补充 #9c20e7')
    expect(verdictText(t, { kind: 'filtered', rule: 'min-gap' })).toBe('已过滤 · 节流')
    expect(verdictText(t, { kind: 'filtered' })).toBe('已过滤')
    // 没有工单的决定不能渲染出孤零零的 `#`。
    expect(verdictText(t, { kind: 'dispatch', ticketId: '' })).toBe('派发')
  })
})

describe('source line', () => {
  it('shows the conversation for a user message', () => {
    expect(signalSourceText(t, signal({ kind: 'user-message' }))).toBe('对话')
  })

  it('joins the source and thread names', () => {
    expect(signalSourceText(t, signal({ sourceName: '配置文件', threadName: '变更' }))).toBe(
      '配置文件 · 变更',
    )
  })

  it('keeps whatever part exists', () => {
    expect(signalSourceText(t, signal({ sourceName: '配置文件' }))).toBe('配置文件')
    expect(signalSourceText(t, signal({}))).toBe('')
  })
})

describe('filterSignals', () => {
  const views = [
    signal({ signalId: 's-1', kind: 'user-message', text: '把 README 改一下', receivedAt: NOW + 300 }),
    signal({
      signalId: 's-2',
      kind: 'perception',
      text: '工单 t-1 已结束',
      sourceName: '工单感知',
      threadName: 'tickets',
      receivedAt: NOW + 200,
      decision: { action: 'reply', at: NOW + 200 },
    }),
    signal({
      signalId: 's-3',
      kind: 'perception',
      text: 'app.yml 被修改',
      sourceName: '配置文件',
      threadName: '变更',
      receivedAt: NOW + 100,
      delivered: false,
      rule: 'match',
    }),
  ]

  it('intersects the two filters with the search', () => {
    expect(filterSignals(views, 'all', 'all', '', ctx).map(view => view.signalId)).toEqual([
      's-1',
      's-2',
      's-3',
    ])
    expect(filterSignals(views, 'perception', 'all', '', ctx).map(view => view.signalId)).toEqual([
      's-2',
      's-3',
    ])
    expect(filterSignals(views, 'all', 'filtered', '', ctx).map(view => view.signalId)).toEqual([
      's-3',
    ])
    expect(filterSignals(views, 'perception', 'reply', '', ctx).map(view => view.signalId)).toEqual([
      's-2',
    ])
  })

  it('searches the text, source and thread names case-insensitively', () => {
    expect(filterSignals(views, 'all', 'all', 'APP.YML', ctx).map(view => view.signalId)).toEqual([
      's-3',
    ])
    expect(filterSignals(views, 'all', 'all', '配置文件', ctx).map(view => view.signalId)).toEqual([
      's-3',
    ])
    expect(filterSignals(views, 'all', 'all', 'tickets', ctx).map(view => view.signalId)).toEqual([
      's-2',
    ])
  })

  it('also matches the visible verdict copy', () => {
    expect(filterSignals(views, 'all', 'all', '响应', ctx).map(view => view.signalId)).toEqual([
      's-2',
    ])
  })

  it('builds the haystack from user-visible fields only', () => {
    const haystack = signalHaystack(views[0]!, ctx)

    expect(haystack).toContain('把 readme 改一下')
    expect(haystack).toContain('用户')
  })
})

describe('empty states', () => {
  it('separates searching from no-match', () => {
    expect(signalEmptyKey('all', 'all', true, true)).toBe('eventsSearching')
    expect(signalEmptyKey('all', 'all', true, false)).toBe('eventsNoMatch')
  })

  it('names the empty kind', () => {
    expect(signalEmptyKey('all', 'all', false, false)).toBe('eventsEmptyAll')
    expect(signalEmptyKey('user', 'all', false, false)).toBe('eventsEmptyUser')
    expect(signalEmptyKey('timer', 'all', false, false)).toBe('eventsEmptyTimer')
    expect(signalEmptyKey('perception', 'all', false, false)).toBe('eventsEmptyPerception')
  })

  it('names the empty verdict, which is more specific than the kind', () => {
    expect(signalEmptyKey('all', 'filtered', false, false)).toBe('eventsEmptyFiltered')
    expect(signalEmptyKey('all', 'dispatch', false, false)).toBe('eventsEmptyDispatch')
    expect(signalEmptyKey('all', 'append', false, false)).toBe('eventsEmptyAppend')
    expect(signalEmptyKey('all', 'supplement', false, false)).toBe('eventsEmptySupplement')
    expect(signalEmptyKey('all', 'reply', false, false)).toBe('eventsEmptyReply')
    expect(signalEmptyKey('perception', 'reply', false, false)).toBe('eventsEmptyReply')
  })
})
