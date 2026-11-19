// src/client/lib/format.ts
//
// 展示层纯格式化：卡片时间、相对时间与风险标签。文案全部来自词典。

import type { ApprovalView } from '../../shared/approvals.ts'
import type { Dict, Translate } from '../i18n.ts'

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

/**
 * 列表里的相对时间：一分钟内是「刚刚」，之后按本地化的相对单位，一周以上回到
 * 绝对时间——「37 天前」不如直接给日期好读。
 *
 * 时间可能来自另一台机器的时钟；未来值一律按「刚刚」处理，不显示负数的过去。
 */
export function formatRelativeTime(
  t: Translate,
  language: string,
  at: number,
  now: number,
): string {
  const elapsed = Math.max(0, now - at)
  if (elapsed < 60_000) return t('timeJustNow')

  const formatter = new Intl.RelativeTimeFormat(language.length > 0 ? language : 'en', {
    numeric: 'always',
  })
  const minutes = Math.floor(elapsed / 60_000)
  if (minutes < 60) return formatter.format(-minutes, 'minute')
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return formatter.format(-hours, 'hour')
  const days = Math.floor(hours / 24)
  if (days < 7) return formatter.format(-days, 'day')
  return formatTimestamp(language, at)
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
