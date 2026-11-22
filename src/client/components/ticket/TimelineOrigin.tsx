// src/client/components/ticket/TimelineOrigin.tsx
//
// 来源行：这张单为什么存在。它不占交接行，也不参与计数；没有信号时退回工单本身，
// 不编造一个来源。

import { Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ReactElement } from 'react'
import type { DetailOrigin } from '../../../shared/ticket-detail.ts'
import type { Translate } from '../../i18n.ts'
import { formatClockTime, formatFullTime, originKindKey } from '../../lib/chain.ts'

export interface TimelineOriginProps {
  t: Translate
  language: string
  origin: DetailOrigin
  fallbackText: string
  fallbackAt: number
}

export function TimelineOrigin({
  t,
  language,
  origin,
  fallbackText,
  fallbackAt,
}: TimelineOriginProps): ReactElement {
  const signal = origin.signal
  const text = signal?.text ?? fallbackText
  const at = signal?.receivedAt ?? fallbackAt
  return (
    <div className="pa-timeline__origin">
      <span className="pa-timeline__origin-kind">{t(originKindKey(signal?.kind))}</span>
      <Tooltip label={text} side="top" delayMs={300} onlyWhenClipped>
        <span className="pa-timeline__origin-text">{text}</span>
      </Tooltip>
      <Tooltip label={formatFullTime(language, at)} side="top" align="end">
        <time
          className="pa-timeline__origin-time"
          dateTime={new Date(at).toISOString()}
          aria-label={formatFullTime(language, at)}
        >
          {formatClockTime(at)}
        </time>
      </Tooltip>
    </div>
  )
}
