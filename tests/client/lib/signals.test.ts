// tests/client/lib/signals.test.ts
//
// 事件页的纯逻辑：胶囊过滤、搜索、结局与来源行。断言落在用户读到的语义上。

import { describe, expect, it } from 'vitest'
import type { SignalView } from '../../../src/shared/signals.ts'
import { translateFor } from '../../../src/client/i18n.ts'
import {
  filterSignals,
  matchesSignalCapsule,
  ruleKey,
  signalEmptyKey,
  signalHaystack,
  signalKindKey,
  signalSourceText,
  signalVerdict,
  verdictLabelKey,
  verdictText,
} from '../../../src/client/lib/signals.ts'

const t = translateFor('zh')
const NOW = 1_700_000_000_000

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

describe('capsules', () => {
  it('selects by signal kind', () => {
    expect(matchesSignalCapsule(signal({ kind: 'user-message' }), 'user')).toBe(true)
    expect(matchesSignalCapsule(signal({ kind: 'timer' }), 'timer')).toBe(true)
    expect(matchesSignalCapsule(signal({ kind: 'perception' }), 'perception')).toBe(true)
    expect(matchesSignalCapsule(signal({ kind: 'perception' }), 'user')).toBe(false)
  })

  it('treats only an undelivered signal as filtered', () => {
    expect(matchesSignalCapsule(signal({ delivered: false }), 'filtered')).toBe(true)
    expect(matchesSignalCapsule(signal({ delivered: false }), 'perception')).toBe(true)
    expect(matchesSignalCapsule(signal({ delivered: true }), 'filtered')).toBe(false)
  })

  it('keeps everything under all', () => {
    expect(matchesSignalCapsule(signal({ delivered: false }), 'all')).toBe(true)
  })
})

describe('kind labels', () => {
  it('maps every kind to a localized label', () => {
    expect(t(signalKindKey('user-message'))).toBe('用户')
    expect(t(signalKindKey('timer'))).toBe('定时')
    expect(t(signalKindKey('perception'))).toBe('感知')
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

  it('intersects the capsule with the search', () => {
    expect(filterSignals(views, 'all', '', { t, language: 'zh' }).map(view => view.signalId)).toEqual([
      's-1',
      's-2',
      's-3',
    ])
    expect(
      filterSignals(views, 'perception', '', { t, language: 'zh' }).map(view => view.signalId),
    ).toEqual(['s-2', 's-3'])
    expect(
      filterSignals(views, 'filtered', '', { t, language: 'zh' }).map(view => view.signalId),
    ).toEqual(['s-3'])
  })

  it('searches the text, source and thread names case-insensitively', () => {
    expect(
      filterSignals(views, 'all', 'APP.YML', { t, language: 'zh' }).map(view => view.signalId),
    ).toEqual(['s-3'])
    expect(
      filterSignals(views, 'all', '配置文件', { t, language: 'zh' }).map(view => view.signalId),
    ).toEqual(['s-3'])
    expect(
      filterSignals(views, 'all', 'tickets', { t, language: 'zh' }).map(view => view.signalId),
    ).toEqual(['s-2'])
  })

  it('also matches the visible verdict copy', () => {
    expect(
      filterSignals(views, 'all', '响应', { t, language: 'zh' }).map(view => view.signalId),
    ).toEqual(['s-2'])
  })

  it('builds the haystack from user-visible fields only', () => {
    const haystack = signalHaystack(views[0]!, { t, language: 'zh' })

    expect(haystack).toContain('把 readme 改一下')
    expect(haystack).toContain('用户')
  })
})

describe('empty states', () => {
  it('separates searching from no-match', () => {
    expect(signalEmptyKey('all', true, true, false)).toBe('eventsSearching')
    expect(signalEmptyKey('all', true, false, false)).toBe('eventsNoMatch')
  })

  it('names the empty capsule', () => {
    expect(signalEmptyKey('all', false, false, false)).toBe('eventsEmptyAll')
    expect(signalEmptyKey('user', false, false, false)).toBe('eventsEmptyUser')
    expect(signalEmptyKey('timer', false, false, false)).toBe('eventsEmptyTimer')
    expect(signalEmptyKey('perception', false, false, false)).toBe('eventsEmptyPerception')
    expect(signalEmptyKey('filtered', false, false, false)).toBe('eventsEmptyFiltered')
  })

  it('falls back to the generic copy when the capsule does have items', () => {
    expect(signalEmptyKey('perception', false, false, true)).toBe('eventsEmptyAll')
  })
})
