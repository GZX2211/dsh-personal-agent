// src/client/components/ConsoleTabStrip.tsx
//
// 总控台的标签条：只渲染与派发选择，不持有业务状态。
// 结构沿用宿主会话视图标签（role="tablist" + role="tab" + aria-selected），
// 待审批数用官方 Tag 表达。

import { Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ReactElement } from 'react'

export interface ConsoleTab {
  id: string
  label: string
  /** 待决数量徽标；0 与缺省都不显示。 */
  badge?: number
}

export interface ConsoleTabStripProps {
  tabs: readonly ConsoleTab[]
  active: string
  onSelect: (id: string) => void
}

export function ConsoleTabStrip({ tabs, active, onSelect }: ConsoleTabStripProps): ReactElement {
  return (
    <div className="pa-console__tabs" role="tablist">
      {tabs.map(tab => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          className="pa-console__tab"
          aria-selected={tab.id === active}
          onClick={() => onSelect(tab.id)}
        >
          {tab.label}
          {tab.badge !== undefined && tab.badge > 0 ? (
            <Tag tone="danger" className="pa-console__count">
              {badgeText(tab.badge)}
            </Tag>
          ) : null}
        </button>
      ))}
    </div>
  )
}

/** 通知点保持小：三位数以上收敛成 `99+`，不把标签挤宽。 */
function badgeText(count: number): string {
  return count > 99 ? '99+' : String(count)
}
