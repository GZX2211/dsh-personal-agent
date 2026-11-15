// src/client/lib/format.ts
//
// 展示层纯格式化：卡片时间与风险标签。文案全部来自词典。

import type { ApprovalView } from '../../shared/approvals.ts'
import type { Dict } from '../i18n.ts'

/**
 * 卡片头部的绝对时间：`11月12日 00:22` / `Nov 12, 00:22`。
 *
 * 用 24 小时制，避免同一列卡片里出现上午/下午两套宽度。
 */
export function formatTimestamp(language: string, at: number): string {
  return new Intl.DateTimeFormat(language.length > 0 ? language : 'en', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(at)
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
