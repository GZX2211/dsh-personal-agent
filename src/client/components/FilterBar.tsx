// src/client/components/FilterBar.tsx
//
// 过滤条：左边胶囊、右边搜索与帮助。胶囊只表达「当前选中哪一个」，
// 过滤与搜索的相交由页面用 lib/filter 算好，这里不感知数据。

import type { ReactElement } from 'react'
import { HelpPopover } from './HelpPopover.tsx'
import { Icon } from './card/Icon.tsx'

export interface CapsuleOption<K extends string = string> {
  id: K
  label: string
}

export interface FilterBarProps {
  options: readonly CapsuleOption[]
  active: string
  onSelect: (id: string) => void
  query: string
  onQueryChange: (query: string) => void
  searchPlaceholder: string
  help: {
    label: string
    title: string
    paragraphs: readonly string[]
    closeLabel: string
  }
}

export function FilterBar({
  options,
  active,
  onSelect,
  query,
  onQueryChange,
  searchPlaceholder,
  help,
}: FilterBarProps): ReactElement {
  return (
    <div className="pa-filterbar">
      <div className="pa-filterbar__capsules" role="group">
        {options.map(option => (
          <button
            key={option.id}
            type="button"
            className="pa-capsule"
            aria-pressed={option.id === active}
            onClick={() => onSelect(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>
      <div className="pa-filterbar__tools">
        <label className="pa-search">
          <span className="pa-search__icon">
            <Icon name="search" size={14} />
          </span>
          <input
            type="text"
            className="pa-search__input"
            value={query}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            onChange={event => onQueryChange(event.target.value)}
          />
        </label>
        <HelpPopover
          label={help.label}
          title={help.title}
          paragraphs={help.paragraphs}
          closeLabel={help.closeLabel}
        />
      </div>
    </div>
  )
}
