// src/client/components/ticket/TicketDetailHeader.tsx
//
// 详情页头部：返回、工单短码、阶段、打开会话；标题；一行元信息（负责人 / Agent 数 /
// 投递次数 / 时长 / 更新时间）。
//
// 阶段徽标与「打开会话」是自绘的：它们与这一行的字号、行高、留白绑在一起，
// 换成官方控件会带进另一套内边距，字和边界立刻对不齐。

import type { ReactElement } from 'react'
import type { TicketDetailResponse } from '../../../shared/ticket-detail.ts'
import type { Translate } from '../../i18n.ts'
import { formatClock, formatDuration, laneDisplayName } from '../../lib/chain.ts'
import { ticketBadge } from '../../lib/tickets.ts'

export interface TicketDetailHeaderProps {
  t: Translate
  detail: TicketDetailResponse
  onBack: () => void
  /** 打开执行会话；缺省时按钮不渲染。 */
  onOpenSession?: (sessionId: string) => void
}

export function TicketDetailHeader({
  t,
  detail,
  onBack,
  onOpenSession,
}: TicketDetailHeaderProps): ReactElement {
  const { ticket, metrics, lanes } = detail
  const badge = ticketBadge(ticket)
  const owner = lanes.find(lane => lane.role === 'lead')

  return (
    <header className="pa-detail__head">
      <div className="pa-detail__top">
        <button type="button" className="pa-detail__back" aria-label={t('ticketDetailBack')} onClick={onBack}>
          {'‹'}
        </button>
        <span className="pa-detail__code">
          {t('ticketLabel')} <b>#{ticket.shortId}</b>
        </span>
        <span className={`pa-tag pa-tag--${stageTone(badge.tone)}`}>{t(badge.labelKey)}</span>
        <span className="pa-detail__spacer" />
        {ticket.workerSessionId === undefined || onOpenSession === undefined ? null : (
          <button
            type="button"
            className="pa-ghost"
            onClick={() => onOpenSession(ticket.workerSessionId as string)}
          >
            {t('ticketDetailOpenSession')} ↗
          </button>
        )}
      </div>
      <h2 className="pa-detail__title">{ticket.title}</h2>
      <div className="pa-detail__meta">
        {owner === undefined ? null : (
          <span>
            {t('ticketDetailOwner')} <b>{laneDisplayName(t, owner)}</b>
          </span>
        )}
        <span>{t('ticketDetailAgents', { count: metrics.agents })}</span>
        <span>{t('ticketDetailHops', { count: metrics.hops })}</span>
        <span>{formatDuration(t, metrics.durationMs)}</span>
        <span>{t('ticketDetailUpdated', { time: formatClock(ticket.updatedAt) })}</span>
      </div>
    </header>
  )
}

function stageTone(tone: ReturnType<typeof ticketBadge>['tone']): 'run' | 'done' | 'warn' | 'err' | 'idle' {
  switch (tone) {
    case 'idle':
      return 'idle'
    case 'business':
      return 'run'
    case 'warn':
      return 'warn'
    case 'error':
      return 'err'
    case 'success':
      return 'done'
  }
}
