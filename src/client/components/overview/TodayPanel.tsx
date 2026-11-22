// src/client/components/overview/TodayPanel.tsx
//
// 今日三格：审核/工单/事件各一个大数字，副行给拆分。三格只读，不做点击跳转。

import type { ReactElement } from 'react'
import type { Translate } from '../../i18n.ts'
import { formatDuration, formatNumber } from '../../lib/format.ts'
import type { TodayView } from '../../lib/overview.ts'

export interface TodayPanelProps {
  t: Translate
  language: string
  today: TodayView
}

export function TodayPanel({ t, language, today }: TodayPanelProps): ReactElement {
  return (
    <section className="pa-overview__today">
      <div className="pa-overview__section-head">
        <h2 className="pa-overview__section-title">{t('overviewToday')}</h2>
        <span className="pa-overview__section-side">{t('overviewTodaySince')}</span>
      </div>
      <div className="pa-metrics">
        <div className="pa-metric">
          <span className="pa-metric__label">{t('overviewTodayApprovals')}</span>
          <span className="pa-metric__value">{formatNumber(language, today.approvalsDecided)}</span>
          <span className="pa-metric__sub">
            {t('overviewTodayApprovalsSub', {
              decided: formatNumber(language, today.approvalsDecided),
              pending: formatNumber(language, today.approvalsPending),
            })}
          </span>
        </div>

        <div className="pa-metric">
          <span className="pa-metric__label">{t('overviewTodayTickets')}</span>
          <span className="pa-metric__value">{formatNumber(language, today.ticketsCompleted)}</span>
          <span
            className="pa-metric__sub"
            data-failed={today.ticketsFailed > 0 ? 'true' : undefined}
            title={
              today.averageTicketMs === undefined
                ? undefined
                : t('overviewTodayTicketsHint', {
                    duration: formatDuration(t, language, today.averageTicketMs),
                  })
            }
          >
            {t('overviewTodayTicketsSub', {
              completed: formatNumber(language, today.ticketsCompleted),
              failed: formatNumber(language, today.ticketsFailed),
            })}
          </span>
        </div>

        <div className="pa-metric">
          <span className="pa-metric__label">{t('overviewTodayEvents')}</span>
          <span className="pa-metric__value">
            {today.signals === undefined ? t('overviewUnknown') : formatNumber(language, today.signals.total)}
          </span>
          <span className="pa-metric__sub">
            {today.signals === undefined
              ? t('overviewUnknown')
              : t('overviewTodayEventsSub', {
                  delivered: formatNumber(language, today.signals.delivered),
                  filtered: formatNumber(language, today.signals.filtered),
                })}
          </span>
        </div>
      </div>
    </section>
  )
}
