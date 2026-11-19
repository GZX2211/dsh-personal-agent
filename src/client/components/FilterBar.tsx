// src/client/components/FilterBar.tsx
//
// 过滤条：左边官方 Pill、右边官方 Input 与帮助。Pill 只表达「当前选中哪一个」，
// 过滤与搜索的相交由页面用 lib/filter 算好，这里不感知数据。
//
// 没有胶囊的页面（来源页）用 `leading` 在左侧放自己的动作按钮：工具栏仍是同一条。

import { IconSearchOutlineRegular, Input, Pill } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ReactElement, ReactNode } from 'react'
import { HelpDialog } from './HelpDialog.tsx'

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
  /** 可选：胶囊之前的内容，用于没有胶囊的页面的左侧动作。 */
  leading?: ReactNode
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
  leading,
  help,
}: FilterBarProps): ReactElement {
  return (
    <div className="pa-toolbar">
      <div className="pa-toolbar__filters" role="group">
        {leading}
        {options.map(option => (
          <Pill
            key={option.id}
            active={option.id === active}
            aria-pressed={option.id === active}
            onClick={() => onSelect(option.id)}
          >
            {option.label}
          </Pill>
        ))}
      </div>
      <div className="pa-toolbar__tools">
        <Input
          className="pa-toolbar__search"
          icon={<IconSearchOutlineRegular />}
          type="text"
          value={query}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          onChange={event => onQueryChange(event.target.value)}
        />
        <HelpDialog
          label={help.label}
          title={help.title}
          paragraphs={help.paragraphs}
          closeLabel={help.closeLabel}
        />
      </div>
    </div>
  )
}
