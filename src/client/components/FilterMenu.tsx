// src/client/components/FilterMenu.tsx
//
// 工具栏里的下拉筛选：官方 Button 做锚点，官方 Menu 做选项列表。
// 只表达「当前选中哪个值」；选项内容与过滤都由调用方给。

import { Button, IconChevronDownOutlineRegular, Menu } from '@deepseek-ai/dsh-client-ui-primitives'
import { useState, type ReactElement } from 'react'

export interface FilterMenuOption {
  id: string
  label: string
}

export interface FilterMenuProps {
  /** 无障碍名：这个下拉在筛什么。 */
  label: string
  /** 当前值文案，显示在触发按钮上。 */
  valueLabel: string
  options: readonly FilterMenuOption[]
  selectedId: string
  onSelect: (id: string) => void
}

export function FilterMenu({
  label,
  valueLabel,
  options,
  selectedId,
  onSelect,
}: FilterMenuProps): ReactElement {
  const [open, setOpen] = useState(false)

  return (
    <Menu
      open={open}
      anchor={
        <Button
          className="pa-filter-menu__trigger"
          variant="outline"
          size="sm"
          aria-label={label}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          <span className="pa-filter-menu__value">{valueLabel}</span>
          <span className="pa-filter-menu__chevron" aria-hidden="true">
            <IconChevronDownOutlineRegular />
          </span>
        </Button>
      }
      items={options.map(option => ({ id: option.id, label: option.label }))}
      selectedId={selectedId}
      onSelect={id => {
        setOpen(false)
        onSelect(id)
      }}
      onClose={() => setOpen(false)}
      align="start"
      side="bottom"
      portal
    />
  )
}
