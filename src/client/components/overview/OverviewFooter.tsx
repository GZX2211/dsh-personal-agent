// src/client/components/overview/OverviewFooter.tsx
//
// 底栏：累计总数与来源/定时计数。10px tertiary，不做主视觉、不做点击。

import type { ReactElement } from 'react'
import type { Translate } from '../../i18n.ts'
import { formatNumber } from '../../lib/format.ts'
import type { FooterView } from '../../lib/overview.ts'

export interface OverviewFooterProps {
  t: Translate
  language: string
  footer: FooterView
}

export function OverviewFooter({ t, language, footer }: OverviewFooterProps): ReactElement {
  const showSources = footer.sourcesRunning > 0 || footer.sourcesError > 0 || footer.timers > 0
  return (
    <footer className="pa-overview__footer">
      <span className="pa-overview__totals">
        {t('overviewTotals', {
          tickets: formatNumber(language, footer.tickets),
          approvals: formatNumber(language, footer.approvals),
          signals: formatNumber(language, footer.signals),
        })}
      </span>
      {showSources ? (
        <span className="pa-overview__sources">
          {footer.sourcesRunning > 0 ? t('overviewSources', { count: footer.sourcesRunning }) : null}
          {footer.sourcesError > 0 ? (
            <span className="pa-overview__sources-error">
              {t('overviewSourcesError', { count: footer.sourcesError })}
            </span>
          ) : null}
          {footer.timers > 0 ? t('overviewTimers', { count: footer.timers }) : null}
        </span>
      ) : null}
    </footer>
  )
}
