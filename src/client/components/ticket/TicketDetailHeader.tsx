// src/client/components/ticket/TicketDetailHeader.tsx
//
// 详情页头部：返回、工单短码、阶段徽标、打开会话；标题；一行元信息。
//
// 元信息只放判断这一单「多重、多久、谁来干的」所需的数量：负责人、Agent 数、
// 投递数、补充数、时长。追加单额外标出「复用会话」，因为它的链路不能脱离上一单读。

import { Button, IconLinkOutlineRegular, Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ReactElement } from 'react'
import type { TicketDetailResponse } from '../../../shared/ticket-detail.ts'
import type { Translate } from '../../i18n.ts'
import { formatDuration, laneDisplayName } from '../../lib/chain.ts'
import { outcomeKey, ticketBadge } from '../../lib/tickets.ts'
import { ticketTagTone } from '../status.ts'

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
  const { ticket, metrics, mode, lanes } = detail
  const badge = ticketBadge(ticket)
  const owner = lanes.find(lane => lane.role === 'lead')
  const workerSessionId = ticket.workerSessionId

  return (
    <header className="pa-detail__head">
      <div className="pa-detail__top">
        <Button className="pa-detail__back" variant="ghost" size="sm" aria-label={t('ticketDetailBack')} onClick={onBack}>
          {'‹'}
        </Button>
        <span className="pa-detail__code">
          {t('ticketLabel')} #{ticket.shortId}
        </span>
        <Tag tone={ticketTagTone(badge.tone)} className="pa-detail__stage">
          {t(badge.labelKey)}
        </Tag>
        {mode === 'append' ? (
          <Tag tone="quiet" className="pa-detail__reuse">
            {t('ticketDetailReusedSession')}
          </Tag>
        ) : null}
        {workerSessionId !== undefined && onOpenSession !== undefined ? (
          <Button
            className="pa-detail__open"
            variant="ghost"
            size="sm"
            icon={<IconLinkOutlineRegular />}
            onClick={() => onOpenSession(workerSessionId)}
          >
            {t('ticketDetailOpenSession')}
          </Button>
        ) : null}
      </div>
      <h2 className="pa-detail__title">{ticket.title}</h2>
      <dl className="pa-detail__meta">
        {owner === undefined ? null : (
          <div className="pa-detail__meta-item">
            <dt>{t('ticketDetailOwner')}</dt>
            <dd>{laneDisplayName(t, owner)}</dd>
          </div>
        )}
        <div className="pa-detail__meta-item">
          <dt>{t('ticketDetailAgents')}</dt>
          <dd>{metrics.agents}</dd>
        </div>
        <div className="pa-detail__meta-item">
          <dt>{t('ticketDetailHops')}</dt>
          <dd>{metrics.hops}</dd>
        </div>
        <div className="pa-detail__meta-item">
          <dt>{t('ticketDetailSupplements')}</dt>
          <dd>{metrics.supplements}</dd>
        </div>
        <div className="pa-detail__meta-item">
          <dt>{t('ticketDetailDuration')}</dt>
          <dd>{formatDuration(t, metrics.durationMs)}</dd>
        </div>
        {ticket.outcome === undefined ? null : (
          <div className="pa-detail__meta-item">
            <dt>{t('deliveryOutcome')}</dt>
            <dd>{t(outcomeKey(ticket.outcome))}</dd>
          </div>
        )}
      </dl>
    </header>
  )
}
