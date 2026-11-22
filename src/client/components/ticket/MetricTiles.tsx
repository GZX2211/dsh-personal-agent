// src/client/components/ticket/MetricTiles.tsx
//
// 交付区底部的四格指标：轮次 / 交接 / 时长 / token。数字优先，标签其次。

import type { ReactElement } from 'react'

export interface MetricTile {
  key: string
  label: string
  value: string
}

export function MetricTiles({ tiles }: { tiles: readonly MetricTile[] }): ReactElement {
  return (
    <div className="pa-tiles">
      {tiles.map(tile => (
        <div key={tile.key} className="pa-tile">
          <b className="pa-tile__value">{tile.value}</b>
          <span className="pa-tile__label">{tile.label}</span>
        </div>
      ))}
    </div>
  )
}
