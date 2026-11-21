// src/client/components/ticket/DeliveryCard.tsx
//
// 交付卡：汇报、验收标准、四个数字。
//
// 汇报是内容不是状态：没有汇报就明说没有，不拿目标文本冒充结论。

import type { ReactElement } from 'react'
import type { TicketDetailResponse } from '../../../shared/ticket-detail.ts'
import type { Translate } from '../../i18n.ts'
import { formatClock, formatDuration, formatTokens } from '../../lib/chain.ts'

export interface DeliveryCardProps {
  t: Translate
  detail: TicketDetailResponse
}

export function DeliveryCard({ t, detail }: DeliveryCardProps): ReactElement {
  const { delivery, metrics, ticket } = detail
  const headMeta =
    ticket.stage === 'ended' && ticket.endedAt !== undefined
      ? t(ticket.outcome === 'failed' ? 'deliveryFailed' : 'deliveryDone', {
          time: formatClock(ticket.endedAt),
        })
      : t('deliveryNoReport')

  return (
    <section className="pa-card">
      <div className="pa-card__head">
        <h3 className="pa-card__title">{t('deliveryTitle')}</h3>
        <span className="pa-detail__spacer" />
        <span className="pa-card__meta">{headMeta}</span>
      </div>

      {delivery.report === undefined || delivery.report.length === 0 ? (
        <div className="pa-empty-line">{t('deliveryNoReport')}</div>
      ) : (
        <p className="pa-report">{delivery.report}</p>
      )}

      {delivery.expectedOutput === undefined ? null : (
        <div className="pa-kv">
          <span className="pa-kv__key">
            {delivery.report === undefined ? t('deliveryExpected') : t('deliveryExpectedCompare')}
          </span>
          <span className="pa-kv__value">{delivery.expectedOutput}</span>
        </div>
      )}

      {delivery.reason === undefined ? null : (
        <div className="pa-kv">
          <span className="pa-kv__key">{t('deliveryReason')}</span>
          <span className="pa-kv__value">{delivery.reason}</span>
        </div>
      )}

      <div className="pa-tiles">
        <div className="pa-tile">
          <b>{metrics.turns}</b>
          <span>{t('deliveryUsageTurns')}</span>
        </div>
        <div className="pa-tile">
          <b>{metrics.hops}</b>
          <span>{t('deliveryUsageHops')}</span>
        </div>
        <div className="pa-tile">
          <b>{formatDuration(t, metrics.durationMs)}</b>
          <span>{t('deliveryUsageDuration')}</span>
        </div>
        <div className="pa-tile">
          <b>{formatTokens(metrics.tokens)}</b>
          <span>{t('deliveryUsageTokens')}</span>
        </div>
      </div>
    </section>
  )
}
