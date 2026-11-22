// src/client/components/ticket/TicketDetailHeader.tsx
//
// 详情头部：返回、短码、阶段、标题、负责人、Agent 数、交接数、时长与打开会话。
// 这里不重复时间线里的信息；用户扫一眼就能知道「这是哪张单、现在什么状态」。

import { Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ReactElement } from 'react'
import type { TicketDetailResponse } from '../../../shared/ticket-detail.ts'
import type { ConsoleActions } from '../../actions.ts'
import type { Translate } from '../../i18n.ts'
import { formatDuration } from '../../lib/format.ts'
import { ticketBadge } from '../../lib/tickets.ts'
import { ticketTagTone } from '../status.ts'

export interface TicketDetailHeaderProps {
  t: Translate
  language: string
  detail: TicketDetailResponse
  handoffCount: number
  ownerName: string
  actions: ConsoleActions
  onBack: () => void
}

export function TicketDetailHeader({
  t,
  language,
  detail,
  handoffCount,
  ownerName,
  actions,
  onBack,
}: TicketDetailHeaderProps): ReactElement {
  const { ticket, metrics } = detail
  const badge = ticketBadge(ticket)
  const stageLabel = ticket.stage === 'queued' ? t('ticketDetailQueued') : t(badge.labelKey)

  return (
    <header className="pa-td__head">
      <div className="pa-td__topline">
        <button
          type="button"
          className="pa-td__back"
          aria-label={t('ticketDetailBack')}
          onClick={onBack}
        >
          ‹
        </button>
        <span className="pa-td__ref">
          {t('ticketLabel')} <b>#{ticket.shortId}</b>
        </span>
        <Tag tone={ticketTagTone(badge.tone)} className="pa-td__stage">
          {stageLabel}
        </Tag>
        <span className="pa-td__spacer" />
        <button
          type="button"
          className="pa-td__open"
          disabled={ticket.workerSessionId === undefined}
          onClick={() => {
            if (ticket.workerSessionId !== undefined) actions.openSession(ticket.workerSessionId)
          }}
        >
          {t('ticketDetailOpenSession')}
        </button>
      </div>

      <h1 className="pa-td__title" title={ticket.title}>
        {ticket.title}
      </h1>

      <div className="pa-td__meta">
        <span className="pa-td__meta-item">
          {t('ticketDetailOwner')} <b>{ownerName}</b>
        </span>
        <span className="pa-td__meta-item">{t('ticketDetailAgents', { count: metrics.agents })}</span>
        <span className="pa-td__meta-item">{t('ticketDetailHandoffs', { count: handoffCount })}</span>
        <span className="pa-td__meta-item">{formatDuration(t, language, metrics.durationMs)}</span>
      </div>
    </header>
  )
}
