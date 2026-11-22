// src/client/components/ticket/MetricTiles.tsx
//
// 交付区底部的四格指标：轮次 / 交接 / 时长 / token。
// 与概览页共用 `.pa-metrics` 指标卡；标签在上、数值在下，卡片外观由共享样式定义。

import type { ReactElement } from 'react'

export interface MetricTile {
  key: string
  label: string
  value: string
}

export function MetricTiles({ tiles }: { tiles: readonly MetricTile[] }): ReactElement {
  return (
    <div className="pa-metrics pa-fold__metrics">
      {tiles.map(tile => (
        <div key={tile.key} className="pa-metric">
          <span className="pa-metric__label">{tile.label}</span>
          <span className="pa-metric__value">{tile.value}</span>
        </div>
      ))}
    </div>
  )
}
