// src/client/components/ConsoleTabStrip.tsx
//
// 总控台的标签条：只渲染与派发选择，不持有业务状态。
// 结构沿用宿主会话视图标签（role="tablist" + role="tab" + aria-selected），样式见 style.ts。

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
          {tab.badge !== undefined && tab.badge > 0 ? <sup className="pa-console__badge">{tab.badge}</sup> : null}
        </button>
      ))}
    </div>
  )
}
