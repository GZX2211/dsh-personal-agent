// tests/client/lib/sources.test.ts
//
// 来源页的纯展示逻辑：渠道/状态/配置摘要/定时节奏。断言落在用户能读到的文本上，
// 不依赖组件的 DOM 结构。

import { describe, expect, it } from 'vitest'
import type { SourceConfigView, SourceThreadView, SourceView, TimerTiming } from '../../../src/shared/sources.ts'
import { translateFor } from '../../../src/client/i18n.ts'
import {
  channelKindKey,
  formatDuration,
  sourceConfigText,
  sourceEnabledOf,
  sourceErrorKey,
  sourceStatusDot,
  sourceStatusKey,
  threadCountText,
  threadOverrideKey,
  threadOverridesFor,
  timerTimingText,
} from '../../../src/client/lib/sources.ts'

const t = translateFor('zh')

function thread(overrides: Partial<SourceThreadView> = {}): SourceThreadView {
  return {
    id: 'changes',
    name: '变更',
    enabled: true,
    deliveredCount: 0,
    filteredCount: 0,
    ...overrides,
  }
}

function source(overrides: Partial<SourceView> = {}): SourceView {
  return {
    id: 'src-1',
    name: '本地文件',
    enabled: true,
    channelKind: 'fs-watch',
    config: { kind: 'fs-watch', paths: ['D:/watch'], recursive: false },
    status: 'running',
    threads: [thread()],
    deliveredCount: 0,
    filteredCount: 0,
    ...overrides,
  }
}

describe('channel labels', () => {
  it('maps every channel kind to a localized label', () => {
    expect(t(channelKindKey('host-event'))).toBe('内部事件')
    expect(t(channelKindKey('fs-watch'))).toBe('本地文件')
    expect(t(channelKindKey('script'))).toBe('脚本')
  })
})

describe('runtime status', () => {
  it('maps every status to a label', () => {
    expect(t(sourceStatusKey('running'))).toBe('运行中')
    expect(t(sourceStatusKey('stopped'))).toBe('已停止')
    expect(t(sourceStatusKey('error'))).toBe('错误')
  })

  it('maps every status to the shared state dot', () => {
    expect(sourceStatusDot('running')).toBe('done')
    expect(sourceStatusDot('stopped')).toBe('idle')
    expect(sourceStatusDot('error')).toBe('error')
  })
})

describe('config summary', () => {
  it('joins the watched paths with a localized list separator', () => {
    const config: SourceConfigView = { kind: 'fs-watch', paths: ['D:/a', 'D:/b'], recursive: false }

    expect(sourceConfigText('zh', config)).toBe('D:/a、D:/b')
    expect(sourceConfigText('en', config)).toBe('D:/a, D:/b')
  })

  it('lists the subscribed event types', () => {
    const config: SourceConfigView = { kind: 'host-event', events: ['task/closed', 'approval/pending'] }

    expect(sourceConfigText('zh', config)).toBe('task/closed、approval/pending')
  })

  it('shows only the command of a script source', () => {
    expect(sourceConfigText('zh', { kind: 'script', command: 'pwsh' })).toBe('pwsh')
  })

  it('counts the threads through the localized template', () => {
    expect(threadCountText(t, 2)).toBe('线程 2')
    expect(translateFor('en')('sourcesThreadCount', { count: 3 })).toBe('Threads 3')
  })
})

describe('durations', () => {
  it('localizes seconds, minutes, hours and days', () => {
    expect(formatDuration('zh', 45)).toBe('45秒')
    expect(formatDuration('zh', 300)).toBe('5分钟')
    expect(formatDuration('zh', 7_200)).toBe('2小时')
    expect(formatDuration('zh', 172_800)).toBe('2天')
    expect(formatDuration('en', 300)).toBe('5 min')
  })

  it('rounds a sub-unit duration instead of showing a fraction', () => {
    expect(formatDuration('zh', 90)).toBe('2分钟')
  })
})

describe('timer timing', () => {
  it('describes an interval', () => {
    expect(timerTimingText(t, 'zh', { kind: 'every', everySeconds: 300 })).toBe('周期 · 5分钟')
    expect(timerTimingText(t, 'zh', { kind: 'after', afterSeconds: 60 })).toBe('倒计时 · 1分钟')
  })

  it('describes a daily rule with its zone', () => {
    const timing: TimerTiming = { kind: 'daily', time: '09:00', timeZone: 'Asia/Shanghai' }

    expect(timerTimingText(t, 'zh', timing)).toBe('每天 · 09:00 (Asia/Shanghai)')
  })

  it('describes a weekly rule with localized weekdays', () => {
    const timing: TimerTiming = {
      kind: 'weekly',
      time: '09:00',
      timeZone: 'Asia/Shanghai',
      weekdays: [1, 3],
    }

    expect(timerTimingText(t, 'zh', timing)).toBe('每周 · 周一、周三 09:00 (Asia/Shanghai)')
  })

  it('describes cron and recurrence expressions verbatim', () => {
    expect(timerTimingText(t, 'zh', { kind: 'cron', expression: '0 9 * * *', timeZone: 'UTC' })).toBe(
      'Cron · 0 9 * * * (UTC)',
    )
    expect(timerTimingText(t, 'zh', { kind: 'rrule', rrule: 'FREQ=DAILY' })).toBe('重复规则 · FREQ=DAILY')
  })

  it('formats a one-off time with the shared timestamp format', () => {
    const at = new Date(2023, 10, 12, 0, 22).toISOString()

    expect(timerTimingText(t, 'zh', { kind: 'at', scheduledAt: at })).toBe('定时 · 11月12日 00:22')
  })
})

describe('source error keys', () => {
  it('maps the stable codes to readable copy', () => {
    expect(t(sourceErrorKey('source-not-found'))).toBe('来源不存在或已删除')
    expect(t(sourceErrorKey('source-invalid'))).toBe('来源参数不合法')
    expect(t(sourceErrorKey('source-start-failed'))).toBe('来源启动失败')
    expect(t(sourceErrorKey('http-error'))).toBe('操作失败，请稍后重试')
  })
})

describe('optimistic overrides', () => {
  it('prefers the override and returns to the snapshot once it is cleared', () => {
    const view = source()

    expect(sourceEnabledOf(view, {})).toBe(true)
    expect(sourceEnabledOf(view, { [view.id]: false })).toBe(false)
    // 失败回滚 = 清掉覆盖，不需要另存旧值。
    expect(sourceEnabledOf(view, {})).toBe(true)
  })

  it('keeps each source-thread pair independent', () => {
    const view = source({
      threads: [thread({ id: 'a', name: '甲' }), thread({ id: 'b', name: '乙' })],
    })
    const overrides = {
      [threadOverrideKey(view.id, 'a')]: false,
      [threadOverrideKey('src-2', 'b')]: false,
    }

    expect(threadOverridesFor(view, overrides)).toEqual({ a: false })
    expect(threadOverrideKey('src-1', 'a')).not.toBe(threadOverrideKey('src-2', 'a'))
  })

  it('returns no override for threads that were never touched', () => {
    expect(threadOverridesFor(source(), {})).toEqual({})
  })
})
