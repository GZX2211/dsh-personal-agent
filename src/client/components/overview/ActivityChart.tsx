// src/client/components/overview/ActivityChart.tsx
//
// 过去 7 天的活动：投递在下、过滤在上，按当天总数 / 7 天最大值缩放。
// 全 0 时只显示空态，不画误导性的空图；旧快照没有 activity 时整块隐藏。

import type { ReactElement } from 'react'
import type { Translate } from '../../i18n.ts'
import type { ActivityStats } from '../../../shared/runtime.ts'
import { formatDayLabel } from '../../lib/format.ts'

/** 图高：与 styles/overview/chart.ts 的 `.pa-overview__bars` 保持一致。 */
const CHART_HEIGHT = 54

export interface ActivityChartProps {
  t: Translate
  language: string
  activity?: ActivityStats
}

export function ActivityChart({ t, language, activity }: ActivityChartProps): ReactElement | null {
  if (activity === undefined) return null

  const max = activity.days.reduce((peak, day) => Math.max(peak, day.delivered + day.filtered), 0)

  return (
    <section className="pa-overview__chart">
      <div className="pa-overview__chart-head">
        <h2 className="pa-overview__section-title">{t('overviewChartTitle')}</h2>
        <span className="pa-overview__legend">
          <span className="pa-overview__legend-dot" data-kind="delivered" aria-hidden="true" />
          {t('overviewChartDelivered')}
          <span className="pa-overview__legend-dot" data-kind="filtered" aria-hidden="true" />
          {t('overviewChartFiltered')}
        </span>
      </div>

      {max === 0 ? (
        <p className="pa-overview__empty-line">{t('overviewChartEmpty')}</p>
      ) : (
        <>
          <div className="pa-overview__bars">
            {activity.days.map(day => {
              const total = day.delivered + day.filtered
              const totalHeight = max === 0 ? 0 : Math.round((total / max) * CHART_HEIGHT)
              const deliveredHeight = total === 0 ? 0 : Math.round((day.delivered / total) * totalHeight)
              const filteredHeight = totalHeight - deliveredHeight
              const label = t('overviewChartDay', {
                day: formatDayLabel(language, day.start),
                delivered: day.delivered,
                filtered: day.filtered,
              })
              return (
                <div key={day.start} className="pa-overview__bar-col" title={label} aria-label={label}>
                  {total === 0 ? (
                    <span className="pa-overview__bar" data-kind="empty" style={{ height: '2px' }} />
                  ) : (
                    <>
                      <span
                        className="pa-overview__bar"
                        data-kind="filtered"
                        style={{ height: `${filteredHeight}px` }}
                      />
                      <span
                        className="pa-overview__bar"
                        data-kind="delivered"
                        style={{ height: `${deliveredHeight}px` }}
                      />
                    </>
                  )}
                </div>
              )
            })}
          </div>
          <div className="pa-overview__days">
            {activity.days.map(day => (
              <span
                key={day.start}
                className="pa-overview__day"
                data-today={day.start === activity.today.start ? 'true' : undefined}
              >
                {formatDayLabel(language, day.start)}
              </span>
            ))}
          </div>
        </>
      )}
    </section>
  )
}
