// src/client/components/overview/OverviewSkeleton.tsx
//
// 首次加载的骨架：只画灰块，不显示具体数字，避免加载瞬间闪出一排 0。

import type { ReactElement } from 'react'
import type { Translate } from '../../i18n.ts'

export interface OverviewSkeletonProps {
  t: Translate
}

export function OverviewSkeleton({ t }: OverviewSkeletonProps): ReactElement {
  return (
    <div className="pa-overview__skeleton" aria-busy="true" aria-label={t('overviewLoading')}>
      <div className="pa-overview__skeleton-row" />
      <div className="pa-overview__skeleton-row" />
      <div className="pa-overview__skeleton-tile" />
      <div className="pa-overview__skeleton-row" />
      <div className="pa-overview__skeleton-row" />
    </div>
  )
}
