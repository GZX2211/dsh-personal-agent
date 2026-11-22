// src/client/components/ticket/DeliveryFold.tsx
//
// 交付区：汇报全文、结果与四项指标。默认折叠；已结束且有汇报时由页面展开。
// 这里没有独立的「汇报」类型——汇报只在这一个地方出现。

import { MarkdownText } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ReactElement } from 'react'
import type { TicketDetailResponse } from '../../../shared/ticket-detail.ts'
import type { Translate } from '../../i18n.ts'
import { formatDuration, formatTokens } from '../../lib/format.ts'
import { FoldSection } from './FoldSection.tsx'
import { MetricTiles } from './MetricTiles.tsx'

export interface DeliveryFoldProps {
  t: Translate
  language: string
  detail: TicketDetailResponse
  handoffCount: number
  open: boolean
  onToggle: () => void
}

export function DeliveryFold({
  t,
  language,
  detail,
  handoffCount,
  open,
  onToggle,
}: DeliveryFoldProps): ReactElement {
  const { delivery, metrics } = detail
  const status = deliveryStatus(t, detail)
  const duration = formatDuration(t, language, metrics.durationMs)
  const id = 'pa-delivery-fold'

  return (
    <FoldSection
      id={id}
      title={t('ticketDeliveryTitle')}
      subtitle={status}
      meta={t('ticketDeliveryMeta', { count: handoffCount, duration })}
      open={open}
      onToggle={onToggle}
    >
      {delivery.reason === undefined ? null : (
        <div className="pa-fold__kv">
          <span className="pa-fold__key">{t('ticketDeliveryReason')}</span>
          <span className="pa-fold__value">{delivery.reason}</span>
        </div>
      )}
      <div className="pa-fold__kv">
        <span className="pa-fold__key">{t('ticketDeliveryReport')}</span>
        {delivery.report === undefined ? (
          <span className="pa-fold__value pa-fold__value--muted">{t('ticketDeliveryNoReport')}</span>
        ) : (
          <div className="pa-fold__report">
            <MarkdownText
              text={delivery.report}
              variant="compact"
              labels={{
                code: { copyLabel: t('ticketCodeCopy'), copiedLabel: t('ticketCodeCopied') },
                footnotes: t('ticketFootnotes'),
              }}
            />
          </div>
        )}
      </div>
      <MetricTiles
        tiles={[
          { key: 'turns', label: t('ticketMetricTurns'), value: String(metrics.turns) },
          { key: 'handoffs', label: t('ticketMetricHandoffs'), value: String(handoffCount) },
          { key: 'duration', label: t('ticketMetricDuration'), value: duration },
          { key: 'tokens', label: t('ticketMetricTokens'), value: formatTokens(language, metrics.tokens) },
        ]}
      />
    </FoldSection>
  )
}

function deliveryStatus(t: Translate, detail: TicketDetailResponse): string {
  const { ticket } = detail
  switch (ticket.stage) {
    case 'queued':
      return t('ticketDeliveryQueued')
    case 'running':
      return t('ticketDeliveryRunning')
    case 'blocked':
      return t('ticketDeliveryBlocked')
    case 'ended':
      return t(ticket.outcome === 'failed' ? 'ticketOutcomeFailed' : 'ticketOutcomeCompleted')
  }
}
