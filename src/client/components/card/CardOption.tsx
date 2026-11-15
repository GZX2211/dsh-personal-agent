// src/client/components/card/CardOption.tsx
//
// 一个选项行：官方提问卡的单选行——20×20 序号座位 + 标签 14/24 + 说明 13/20，
// 选中时整行铺 hover 底色并描边。已决态只读：行仍可聚焦查看，但不可改。

import type { ReactElement } from 'react'

export interface CardOptionProps {
  index: number
  label: string
  description: string
  selected: boolean
  /** 只读或提交中：禁止改变选择。 */
  locked: boolean
  /** 无障碍分组里的单选语义由外层 radiogroup 提供。 */
  onSelect: () => void
}

export function CardOption({
  index,
  label,
  description,
  selected,
  locked,
  onSelect,
}: CardOptionProps): ReactElement {
  return (
    <div className="pa-card__option-row" data-selected={selected || undefined}>
      <button
        type="button"
        className="pa-card__option"
        role="radio"
        aria-checked={selected}
        aria-label={label}
        disabled={locked}
        onClick={onSelect}
      >
        <span className="pa-card__number" aria-hidden="true">
          {index + 1}
        </span>
        <span className="pa-card__option-copy">
          <span className="pa-card__option-label">{label}</span>
          <span className="pa-card__option-desc">{description}</span>
        </span>
      </button>
    </div>
  )
}
