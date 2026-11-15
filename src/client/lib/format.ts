// src/client/lib/format.ts
//
// 展示层纯格式化：相对时间与风险标签，文案全部来自词典。

import type { ApprovalView } from '../../shared/approvals.ts'
import type { Dict, Translate } from '../i18n.ts'
import { relativeTimeParts } from './approvals.ts'

/** 相对时间文本；超过一周回落到本地化绝对时间。 */
export function formatTime(t: Translate, language: string, now: number, at: number): string {
  const parts = relativeTimeParts(now, at)
  if (parts.kind === 'absolute') return new Date(at).toLocaleString(language)
  switch (parts.unit) {
    case 'now':
      return t('timeNow')
    case 'minute':
      return t('timeMinutesAgo').replace('{n}', String(parts.value))
    case 'hour':
      return t('timeHoursAgo').replace('{n}', String(parts.value))
    case 'day':
      return t('timeDaysAgo').replace('{n}', String(parts.value))
  }
}

export function riskKey(risk: NonNullable<ApprovalView['risk']>): keyof Dict {
  switch (risk) {
    case 'low':
      return 'approvalRiskLow'
    case 'medium':
      return 'approvalRiskMedium'
    case 'high':
      return 'approvalRiskHigh'
  }
}
