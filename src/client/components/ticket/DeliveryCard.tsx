// src/client/components/ticket/DeliveryCard.tsx
//
// 交付卡：这一单交回了什么、离验收标准还差什么，以及四个常用指标。
//
// 汇报与验收标准是内容，不是状态：没有汇报就明说没有，不拿目标文本冒充结论。

import type { ReactElement } from 'react'
import type { TicketDetailResponse } from '../../../shared/ticket-detail.ts'
import type { Translate } from '../../i18n.ts'
import { formatDuration } from '../../lib/chain.ts'

export interface DeliveryCardProps {
  t: Translate
  detail: TicketDetailResponse
}

export function DeliveryCard({ t, detail }: DeliveryCardProps): ReactElement {
  const { delivery, metrics } = detail
  const usage = [
    { label: t('deliveryUsageTurns'), value: String(metrics.turns) },
    { label: t('deliveryUsageHops'), value: String(metrics.hops) },
    { label: t('deliveryUsageDuration'), value: formatDuration(t, metrics.durationMs) },
    { label: t('deliveryUsageTokens'), value: String(metrics.tokens) },
  ]

  return (
    <section className="pa-delivery" aria-label={t('deliveryTitle')}>
      <h3 className="pa-delivery__title">{t('deliveryTitle')}</h3>

      <div className="pa-delivery__block">
        <span className="pa-delivery__label">{t('deliveryReport')}</span>
        <p className="pa-delivery__text">{delivery.report ?? t('deliveryNoReport')}</p>
      </div>

      {delivery.expectedOutput === undefined ? null : (
        <div className="pa-delivery__block">
          <span className="pa-delivery__label">{t('deliveryExpected')}</span>
          <p className="pa-delivery__text pa-delivery__text--muted">{delivery.expectedOutput}</p>
        </div>
      )}

      {delivery.reason === undefined ? null : (
        <div className="pa-delivery__block">
          <span className="pa-delivery__label">{t('deliveryReason')}</span>
          <p className="pa-delivery__text pa-delivery__text--muted">{delivery.reason}</p>
        </div>
      )}

      <dl className="pa-delivery__usage">
        {usage.map(item => (
          <div className="pa-delivery__usage-item" key={item.label}>
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
