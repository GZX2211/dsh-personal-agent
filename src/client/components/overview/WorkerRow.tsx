// src/client/components/overview/WorkerRow.tsx
//
// 一个执行会话一行：状态点 + 标题 + 上下文环，副行给工单短码、轮次/时长
// 与最后活动。整行可点，打开对应执行会话；行内不放审批/停止按钮。

import { StateDot, type StateDotState } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ReactElement } from 'react'
import type { Translate } from '../../i18n.ts'
import { formatDuration, formatRelativeTime, formatTokens } from '../../lib/format.ts'
import { contextPercent, type WorkerRow as WorkerRowView } from '../../lib/overview.ts'
import { ContextMeter } from './ContextMeter.tsx'

export interface WorkerRowProps {
  t: Translate
  language: string
  row: WorkerRowView
  now: number
  onOpen: () => void
}

export function WorkerRow({ t, language, row, now, onOpen }: WorkerRowProps): ReactElement {
  const statusText = statusLabel(t, row)
  const contextText =
    row.context === undefined
      ? t('overviewContextLabel')
      : row.context.ratio === undefined
        ? `${t('overviewContextLabel')} ${formatTokens(language, row.context.usedTokens)}`
        : `${t('overviewContextLabel')} ${contextPercent(row.context.ratio)}%`

  let left: string
  let right: string | undefined
  if (row.status === 'waiting') {
    left = `${t('ticketLabel')} #${row.ticket.shortId} · ${t('overviewWorkerWaiting')}`
    right =
      row.waitingMs === undefined
        ? undefined
        : t('overviewWorkerWaitingFor', { duration: formatDuration(t, language, row.waitingMs) })
  } else if (row.status === 'running') {
    left = `${t('ticketLabel')} #${row.ticket.shortId} · ${t('overviewWorkerTurn', { turn: row.turn })} · ${formatDuration(t, language, row.elapsedMs)}`
    right = relativeOf(t, language, row.lastActivityAt, now)
  } else {
    left = `${t('ticketLabel')} #${row.ticket.shortId} · ${statusText}`
    right = relativeOf(t, language, row.lastActivityAt, now)
  }

  return (
    <button
      type="button"
      className="pa-overview__worker"
      data-status={row.status}
      title={row.ticket.title}
      aria-label={`${row.ticket.title} ${statusText} ${contextText} ${t('overviewWorkerOpen')}`}
      onClick={onOpen}
    >
      <span className="pa-overview__worker-head">
        <StateDot state={dotStateOf(row.status)} className="pa-overview__worker-dot" />
        <span className="pa-overview__worker-title">{row.ticket.title}</span>
        <ContextMeter
          t={t}
          language={language}
          meter={row.context}
          offline={row.offline}
          unknown={row.status === 'unknown'}
        />
      </span>
      <span className="pa-overview__worker-sub">
        <span>{left}</span>
        {right === undefined ? null : <span className="pa-overview__worker-time">{right}</span>}
      </span>
    </button>
  )
}

function relativeOf(t: Translate, language: string, at: number | undefined, now: number): string | undefined {
  return at === undefined ? undefined : formatRelativeTime(t, language, at, now)
}

function statusLabel(t: Translate, row: WorkerRowView): string {
  switch (row.status) {
    case 'waiting':
      return t('overviewWorkerWaiting')
    case 'running':
      return t('overviewWorkerTurn', { turn: row.turn })
    case 'starting':
      return t('overviewWorkerStarting')
    case 'interrupted':
      return t('overviewWorkerInterrupted')
    case 'offline':
      return t('overviewWorkerOffline')
    case 'idle':
      return t('overviewWorkerIdle')
    case 'unknown':
      return t('overviewWorkerUnknown')
  }
}

function dotStateOf(status: WorkerRowView['status']): StateDotState {
  switch (status) {
    case 'waiting':
    case 'interrupted':
      return 'warning'
    case 'running':
    case 'starting':
      return 'ongoing'
    case 'offline':
      return 'error'
    case 'idle':
    case 'unknown':
      return 'idle'
  }
}
