// tests/client/lib/sources.test.ts
//
// 来源页的纯展示逻辑：渠道/状态/配置摘要/搜索与乐观覆盖。断言落在用户能读到的
// 文本上，不依赖组件的 DOM 结构。

import { describe, expect, it } from 'vitest'
import type { SourceConfigView, SourceThreadView, SourceView } from '../../../src/shared/sources.ts'
import { translateFor } from '../../../src/client/i18n.ts'
import {
  channelKindKey,
  filterSources,
  sourceConfigText,
  sourceEnabledOf,
  sourceErrorKey,
  sourceHaystack,
  sourceStatusDot,
  sourceStatusKey,
  threadCountText,
  threadOverrideKey,
  threadOverridesFor,
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

describe('search', () => {
  const views = [
    source({ id: 'src-1', name: '本地文件', description: '盯住配置文件' }),
    source({
      id: 'src-2',
      name: '工单感知',
      channelKind: 'host-event',
      config: { kind: 'host-event', events: ['task/closed'] },
      threads: [thread({ id: 'closed', name: '关闭' })],
    }),
  ]

  it('matches the source name and description', () => {
    expect(filterSources(views, '配置文件', { t, language: 'zh' }).map(view => view.id)).toEqual([
      'src-1',
    ])
    expect(filterSources(views, '工单', { t, language: 'zh' }).map(view => view.id)).toEqual(['src-2'])
  })

  it('matches thread names and the configuration summary', () => {
    expect(filterSources(views, '关闭', { t, language: 'zh' }).map(view => view.id)).toEqual(['src-2'])
    expect(filterSources(views, 'task/closed', { t, language: 'zh' }).map(view => view.id)).toEqual([
      'src-2',
    ])
    expect(filterSources(views, 'D:/watch', { t, language: 'zh' }).map(view => view.id)).toEqual([
      'src-1',
    ])
  })

  it('matches the visible channel and status labels', () => {
    expect(filterSources(views, '内部事件', { t, language: 'zh' }).map(view => view.id)).toEqual([
      'src-2',
    ])
    expect(filterSources(views, '运行中', { t, language: 'zh' }).map(view => view.id)).toEqual([
      'src-1',
      'src-2',
    ])
  })

  it('returns every source for an empty query and none for a miss', () => {
    expect(filterSources(views, '  ', { t, language: 'zh' })).toHaveLength(2)
    expect(filterSources(views, '不存在的词', { t, language: 'zh' })).toEqual([])
  })

  it('builds the haystack from the fields shown on the card', () => {
    const haystack = sourceHaystack(views[0]!, { t, language: 'zh' })

    expect(haystack).toContain('本地文件')
    expect(haystack).toContain('配置文件')
    expect(haystack).toContain('d:/watch')
    expect(haystack).toContain('运行中')
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
