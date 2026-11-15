// src/client/components/FilterBar.tsx
//
// 两页共用的筛选条：左侧胶囊组、右侧搜索框（方案 §10.2）。只渲染与派发事件，
// 过滤本身由调用方用 lib/filter.ts 的纯函数完成。

import type { ReactElement } from 'react'

export interface FilterSegment {
  id: string
  label: string
}

export interface FilterBarProps {
  segments: readonly FilterSegment[]
  active: string
  onSelect: (id: string) => void
  query: string
  onQueryChange: (value: string) => void
  placeholder: string
}

export function FilterBar({
  segments,
  active,
  onSelect,
  query,
  onQueryChange,
  placeholder,
}: FilterBarProps): ReactElement {
  return (
    <div className="pa-filterbar">
      <div className="pa-filterbar__segments" role="tablist">
        {segments.map(segment => (
          <button
            key={segment.id}
            type="button"
            role="tab"
            className="pa-filterbar__segment"
            aria-selected={segment.id === active}
            onClick={() => onSelect(segment.id)}
          >
            {segment.label}
          </button>
        ))}
      </div>
      <input
        className="pa-filterbar__search"
        type="search"
        value={query}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={event => onQueryChange(event.target.value)}
      />
    </div>
  )
}
