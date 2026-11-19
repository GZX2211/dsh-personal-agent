// src/client/views/Sources.tsx
//
// 来源页：说明条 + 感知来源分区 + 只读的定时来源分区。
//
// 开关与线程开关走乐观更新、失败回滚；测试与删除只在展开区提供。所有写操作都经
// 唯一网络边界（lib/http），错误按稳定码给出具体文案。

import { AnimatedRows, Button, Toast } from '@deepseek-ai/dsh-client-ui-primitives'
import { useState, type ReactElement } from 'react'
import type { SnapshotResponse } from '../../shared/api.ts'
import type { SignalView } from '../../shared/signals.ts'
import type { SourceView } from '../../shared/sources.ts'
import type { ConsoleActions } from '../actions.ts'
import { SourceCard } from '../components/SourceCard.tsx'
import { TimerCard } from '../components/TimerCard.tsx'
import type { Dict, Translate } from '../i18n.ts'
import { ApiError, removeSource, testSource, toggleSource } from '../lib/http.ts'
import {
  sourceEnabledOf,
  sourceErrorKey,
  threadOverrideKey,
  threadOverridesFor,
} from '../lib/sources.ts'

export interface SourcesProps {
  t: Translate
  language: string
  snapshot?: SnapshotResponse
  /** 连接中断时的原因；非空即显示重试横幅。 */
  error?: string
  refresh: () => void
  actions: ConsoleActions
}

export function Sources({ t, language, snapshot, error, refresh, actions }: SourcesProps): ReactElement {
  const [busy, setBusy] = useState<Record<string, boolean>>({})
  const [deleting, setDeleting] = useState<Record<string, boolean>>({})
  const [enabledOverride, setEnabledOverride] = useState<Record<string, boolean>>({})
  const [threadOverride, setThreadOverride] = useState<Record<string, boolean>>({})
  const [testResults, setTestResults] = useState<Record<string, SignalView[]>>({})
  const [toast, setToast] = useState<{ seq: number; text: string }>()

  const sources = snapshot?.sources ?? []
  const timers = snapshot?.timers ?? []
  const routerSessionId = snapshot?.routerSessionId
  const now = Date.now()

  const notice = (text: string): void => setToast({ seq: Date.now(), text })

  const testFailureText = (failure: unknown): string =>
    t(failure instanceof ApiError ? sourceErrorKey(failure.code) : 'sourceTestFailed')

  const markBusy = (sourceId: string, value: boolean): void => {
    setBusy(previous => {
      if (value) return { ...previous, [sourceId]: true }
      const next = { ...previous }
      delete next[sourceId]
      return next
    })
  }

  const setEnabled = async (source: SourceView, enabled: boolean): Promise<void> => {
    if (busy[source.id] === true) return
    markBusy(source.id, true)
    setEnabledOverride(previous => ({ ...previous, [source.id]: enabled }))
    try {
      await toggleSource(source.id, { enabled })
      refresh()
    } catch {
      notice(t('sourceToggleFailed'))
    } finally {
      markBusy(source.id, false)
      setEnabledOverride(previous => {
        const next = { ...previous }
        delete next[source.id]
        return next
      })
    }
  }

  const setThreadEnabled = async (
    source: SourceView,
    threadId: string,
    enabled: boolean,
  ): Promise<void> => {
    if (busy[source.id] === true) return
    const key = threadOverrideKey(source.id, threadId)
    markBusy(source.id, true)
    setThreadOverride(previous => ({ ...previous, [key]: enabled }))
    try {
      await toggleSource(source.id, { enabled, threadId })
      refresh()
    } catch {
      notice(t('sourceToggleFailed'))
    } finally {
      markBusy(source.id, false)
      setThreadOverride(previous => {
        const next = { ...previous }
        delete next[key]
        return next
      })
    }
  }

  const runTest = async (source: SourceView): Promise<void> => {
    if (busy[source.id] === true) return
    markBusy(source.id, true)
    try {
      const result = await testSource(source.id, {})
      setTestResults(previous => ({ ...previous, [source.id]: result.signals }))
      refresh()
    } catch (failure) {
      notice(testFailureText(failure))
    } finally {
      markBusy(source.id, false)
    }
  }

  const runRemove = async (source: SourceView): Promise<void> => {
    setDeleting(previous => ({ ...previous, [source.id]: true }))
    try {
      await removeSource(source.id)
      notice(t('sourceRemoveDone'))
      setTestResults(previous => {
        const next = { ...previous }
        delete next[source.id]
        return next
      })
      refresh()
    } catch {
      notice(t('sourceRemoveFailed'))
    } finally {
      setDeleting(previous => {
        const next = { ...previous }
        delete next[source.id]
        return next
      })
    }
  }

  return (
    <div className="pa-page">
      {error !== undefined ? (
        <div className="pa-banner" role="status">
          <span>{t('approvalConnectionLost')}</span>
          <button type="button" className="pa-banner__retry" onClick={() => refresh()}>
            {t('approvalRefresh')}
          </button>
        </div>
      ) : null}

      <p className="pa-section__intro">{t('sourcesIntro')}</p>

      <section className="pa-section">
        <div className="pa-section__head">
          <h2 className="pa-section__title">{t('sourcesSection')}</h2>
          <Button
            variant="outline"
            size="sm"
            disabled={routerSessionId === undefined}
            onClick={() => {
              if (routerSessionId !== undefined) actions.openSession(routerSessionId)
            }}
          >
            {t('sourcesCreateInChat')}
          </Button>
        </div>

        <AnimatedRows
          className="pa-list pa-list--inline"
          role="list"
          label={t('sourcesSection')}
          rowKeys={sources.map(source => source.id)}
          ready={sources.length > 0}
          resetKey="sources"
        >
          {sources.length === 0 ? (
            <span className="pa-console__empty">{t('sourcesEmpty')}</span>
          ) : (
            sources.map(source => (
              <SourceCard
                key={source.id}
                t={t}
                language={language}
                now={now}
                source={source}
                enabled={sourceEnabledOf(source, enabledOverride)}
                threadEnabled={threadOverridesFor(source, threadOverride)}
                busy={busy[source.id] === true}
                deleting={deleting[source.id] === true}
                testResult={testResults[source.id]}
                onToggleSource={enabled => {
                  void setEnabled(source, enabled)
                }}
                onToggleThread={(threadId, enabled) => {
                  void setThreadEnabled(source, threadId, enabled)
                }}
                onTest={() => {
                  void runTest(source)
                }}
                onRestart={() => {
                  void setEnabled(source, true)
                }}
                onRemove={() => {
                  void runRemove(source)
                }}
              />
            ))
          )}
        </AnimatedRows>
      </section>

      <section className="pa-section">
        <div className="pa-section__head">
          <h2 className="pa-section__title">{t('sourcesTimerSection')}</h2>
        </div>

        <AnimatedRows
          className="pa-list pa-list--inline"
          role="list"
          label={t('sourcesTimerSection')}
          rowKeys={timers.map(timer => timer.scheduleId)}
          ready={timers.length > 0}
          resetKey="timers"
        >
          {timers.length === 0 ? (
            <span className="pa-console__empty">{t('sourcesTimersEmpty')}</span>
          ) : (
            timers.map(timer => (
              <TimerCard
                key={timer.scheduleId}
                t={t}
                language={language}
                now={now}
                timer={timer}
                onOpen={() => actions.openSchedules()}
              />
            ))
          )}
        </AnimatedRows>
      </section>

      {toast === undefined ? null : (
        <Toast key={toast.seq} text={toast.text} onDone={() => setToast(undefined)} />
      )}
    </div>
  )
}
