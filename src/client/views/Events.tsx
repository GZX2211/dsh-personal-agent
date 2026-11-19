// src/client/views/Events.tsx
//
// 事件页：两个下拉（事件类型 / 处理方式）+ 搜索 + 信号卡片。
//
// 查询为空时只看快照里最近一段；输入搜索词后走 Host 的全量检索，覆盖快照窗口
// 之外的历史。两种数据源只在「基础列表」这一处分叉，过滤与展示完全共用。

import { AnimatedRows } from '@deepseek-ai/dsh-client-ui-primitives'
import { useState, type ReactElement } from 'react'
import type { SnapshotResponse } from '../../shared/api.ts'
import { EventFilterBar } from '../components/EventFilterBar.tsx'
import { SignalCard } from '../components/SignalCard.tsx'
import type { Translate } from '../i18n.ts'
import { useSignalQuery } from '../hooks/useSignalQuery.ts'
import {
  filterSignals,
  signalEmptyKey,
  type SignalKindFilter,
  type SignalVerdictFilter,
} from '../lib/signals.ts'

export interface EventsProps {
  t: Translate
  language: string
  snapshot?: SnapshotResponse
  /** 连接中断时的原因；非空即显示重试横幅。 */
  error?: string
  refresh: () => void
  /** 点结局跳工单；缺省时结局只读。 */
  onOpenTicket?: (ticketId: string) => void
}

export function Events({
  t,
  language,
  snapshot,
  error,
  refresh,
  onOpenTicket,
}: EventsProps): ReactElement {
  const [kind, setKind] = useState<SignalKindFilter>('all')
  const [verdict, setVerdict] = useState<SignalVerdictFilter>('all')
  const [query, setQuery] = useState('')

  // 轮询带来新信号时，历史检索也要重跑：否则搜索结果是上一时刻的账本。
  const revision = `${snapshot?.signals.length ?? 0}:${snapshot?.signals[0]?.receivedAt ?? 0}`
  const history = useSignalQuery(query, revision)
  const searching = query.trim().length > 0
  const base = searching ? (history.result?.signals ?? []) : (snapshot?.signals ?? [])
  const visible = filterSignals(base, kind, verdict, query, { t, language })
  const now = Date.now()

  return (
    <>
      <EventFilterBar
        t={t}
        kind={kind}
        verdict={verdict}
        onKindChange={setKind}
        onVerdictChange={setVerdict}
        query={query}
        onQueryChange={setQuery}
        help={{
          label: t('helpOpen'),
          title: t('helpTitle'),
          paragraphs: [t('helpBodyEvents'), t('helpBodySearch')],
          closeLabel: t('helpClose'),
        }}
      />

      {error !== undefined ? (
        <div className="pa-banner" role="status">
          <span>{t('approvalConnectionLost')}</span>
          <button type="button" className="pa-banner__retry" onClick={() => refresh()}>
            {t('approvalRefresh')}
          </button>
        </div>
      ) : null}

      {searching ? (
        <p className="pa-events__status">
          {history.loading
            ? t('eventsSearching')
            : history.result === undefined
              ? undefined
              : `${t('eventsTotal', { count: history.result.total })} · ${t('eventsHistoryHint')}`}
        </p>
      ) : null}

      {history.error === undefined ? null : (
        <p className="pa-events__error" role="alert">
          {t('eventsQueryFailed')}
        </p>
      )}

      <AnimatedRows
        className="pa-list"
        role="list"
        label={t('eventListLabel')}
        rowKeys={visible.map(signal => signal.signalId)}
        ready={visible.length > 0}
        resetKey={`${kind}|${verdict}|${query}`}
      >
        {visible.length === 0 ? (
          <span className="pa-console__empty">
            {t(signalEmptyKey(kind, verdict, searching, history.loading))}
          </span>
        ) : (
          visible.map(signal => (
            <SignalCard
              key={signal.signalId}
              t={t}
              language={language}
              now={now}
              signal={signal}
              {...(onOpenTicket === undefined ? {} : { onOpenTicket })}
            />
          ))
        )}
      </AnimatedRows>
    </>
  )
}
