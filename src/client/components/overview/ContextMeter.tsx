// src/client/components/overview/ContextMeter.tsx
//
// 上下文占用的小环：标签 + 百分比 + 16px SVG。比例只来自 lib/overview 的
// 纯计算，这里只负责把 level 画成颜色、把边界情况写成 tooltip。

import { Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ReactElement } from 'react'
import type { Translate } from '../../i18n.ts'
import { formatTokens } from '../../lib/format.ts'
import {
  contextPercent,
  type ContextLevel,
  type ContextMeterView,
} from '../../lib/overview.ts'

const RING_CIRCUMFERENCE = 2 * Math.PI * 7.2

const LEVEL_STROKE: Record<ContextLevel, string> = {
  normal: 'var(--dsw-alias-state-business-primary)',
  warn: 'var(--dsw-alias-state-warn-primary)',
  critical: 'var(--dsw-alias-state-error-primary)',
  unknown: 'var(--dsw-alias-border-l2)',
}

export interface ContextMeterProps {
  t: Translate
  language: string
  meter?: ContextMeterView
  /** 工单还开着，但没有活 Agent。 */
  offline: boolean
  /** 旧快照没有 workers 字段，无法判断。 */
  unknown: boolean
}

export function ContextMeter({ t, language, meter, offline, unknown }: ContextMeterProps): ReactElement {
  const label = t('overviewContextLabel')
  let value: string
  let level: ContextLevel
  let tooltip: string

  if (meter === undefined) {
    value = t('overviewUnknown')
    level = 'unknown'
    tooltip = offline ? t('overviewWorkerOffline') : unknown ? t('overviewWorkerUnknown') : t('overviewContextNoUsage')
  } else if (meter.ratio === undefined) {
    value = formatTokens(language, meter.usedTokens)
    level = 'unknown'
    tooltip = t('overviewContextNoWindow', { used: formatTokens(language, meter.usedTokens) })
  } else {
    const effectiveWindow = meter.effectiveWindow ?? 0
    const used = formatTokens(language, meter.usedTokens)
    value = `${contextPercent(meter.ratio)}%`
    level = meter.level
    tooltip = t('overviewContextTooltip', {
      used,
      effective: formatTokens(language, effectiveWindow),
      left: formatTokens(language, Math.max(0, effectiveWindow - meter.usedTokens)),
      window: formatTokens(language, meter.windowTokens ?? 0),
    })
  }

  const ratio = meter?.ratio
  const dasharray =
    ratio === undefined ? '2 3' : `${Math.min(1, ratio) * RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`

  return (
    <Tooltip label={tooltip} side="left">
      <span className="pa-context" data-level={level} aria-label={tooltip}>
        <span className="pa-context__label">{label}</span>
        <span className="pa-context__value">{value}</span>
        <svg className="pa-context__ring" viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="8" cy="8" r="7.2" fill="none" strokeWidth="2" stroke="var(--dsw-alias-border-l2)" />
          <circle
            cx="8"
            cy="8"
            r="7.2"
            fill="none"
            strokeWidth="2"
            strokeLinecap="round"
            stroke={LEVEL_STROKE[level]}
            strokeDasharray={dasharray}
            transform="rotate(-90 8 8)"
          />
        </svg>
      </span>
    </Tooltip>
  )
}
