// src/client/components/overview/AttentionBar.tsx
//
// 注意力条：只在需要人时出现，最多两条；每类合并成一条，用 count 表达数量。
// 整行是按钮，跳到对应页面或执行会话。

import { Tag, type TagTone } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ReactElement } from 'react'
import type { Translate } from '../../i18n.ts'
import { formatDuration, riskKey } from '../../lib/format.ts'
import type { AttentionItem, AttentionKind, AttentionTarget } from '../../lib/overview.ts'

export interface AttentionBarProps {
  t: Translate
  language: string
  items: readonly AttentionItem[]
  now: number
  onActivate: (target: AttentionTarget) => void
}

export function AttentionBar({ t, language, items, now, onActivate }: AttentionBarProps): ReactElement | null {
  if (items.length === 0) return null
  const visible = items.slice(0, 2)
  return (
    <div className="pa-overview__attention">
      {visible.map(item => {
        const main = mainText(t, item)
        const meta = metaText(t, language, item, now)
        return (
          <button
            key={item.id}
            type="button"
            className="pa-overview__attention-row"
            data-severity={item.severity}
            aria-label={meta.length === 0 ? main : `${main} ${meta}`}
            onClick={() => onActivate(item.target)}
          >
            <Tag tone={tagTone(item.severity)} className="pa-overview__attention-tag">
              {tagLabel(t, item.kind)}
            </Tag>
            <span className="pa-overview__attention-main">
              <span>{main}</span>
              {meta.length === 0 ? null : <span className="pa-overview__attention-meta">{meta}</span>}
            </span>
            <span className="pa-overview__attention-arrow" aria-hidden="true">
              →
            </span>
          </button>
        )
      })}
      {items.length > 2 ? (
        <span className="pa-overview__attention-more">{t('overviewAttentionMore', { count: items.length - 2 })}</span>
      ) : null}
    </div>
  )
}

function tagTone(severity: AttentionItem['severity']): TagTone {
  return severity === 'danger' ? 'danger' : 'warning'
}

function tagLabel(t: Translate, kind: AttentionKind): string {
  switch (kind) {
    case 'approval':
      return t('overviewAttentionApproval')
    case 'source-error':
      return t('overviewAttentionSource')
    case 'worker-offline':
    case 'worker-interrupted':
      return t('overviewAttentionWorker')
    case 'context-critical':
      return t('overviewAttentionContext')
  }
}

function mainText(t: Translate, item: AttentionItem): string {
  switch (item.kind) {
    case 'approval':
      return item.count === 1
        ? t('overviewAttentionApprovalOne')
        : t('overviewAttentionApprovalMany', { count: item.count })
    case 'source-error':
      return item.count === 1
        ? t('overviewAttentionSourceErrorOne')
        : t('overviewAttentionSourceErrorMany', { count: item.count })
    case 'worker-offline':
      return item.count === 1
        ? t('overviewAttentionOfflineOne')
        : t('overviewAttentionOfflineMany', { count: item.count })
    case 'worker-interrupted':
      return item.count === 1
        ? t('overviewAttentionInterruptedOne')
        : t('overviewAttentionInterruptedMany', { count: item.count })
    case 'context-critical':
      return item.count === 1
        ? t('overviewAttentionContextOne')
        : t('overviewAttentionContextMany', { count: item.count })
  }
}

function metaText(t: Translate, language: string, item: AttentionItem, now: number): string {
  switch (item.kind) {
    case 'approval': {
      const parts: string[] = []
      if (item.oldestAt !== undefined) {
        parts.push(t('overviewAttentionWait', { duration: formatDuration(t, language, now - item.oldestAt) }))
      }
      if (item.risk !== undefined) parts.push(t('overviewAttentionRisk', { risk: t(riskKey(item.risk)) }))
      if (item.blockedCount !== undefined && item.blockedCount > 0) {
        parts.push(
          item.blockedCount === 1
            ? t('overviewAttentionSlotsOne')
            : t('overviewAttentionSlotsMany', { count: item.blockedCount }),
        )
      }
      return parts.join(' · ')
    }
    case 'source-error':
      return t('overviewAttentionSourceHint')
    default:
      return ''
  }
}
