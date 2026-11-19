// src/client/components/card/CardOption.tsx
//
// 一个选项行：序号座位 + 标签 13/20 + 说明 12/18，选中时整行铺 hover 底色
// 并描边。官方原子包没有单选组，这一行保留自建；已决态只读。

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
    <div className="pa-detail__option" data-selected={selected || undefined}>
      <button
        type="button"
        className="pa-detail__option-button"
        role="radio"
        aria-checked={selected}
        aria-label={label}
        disabled={locked}
        onClick={onSelect}
      >
        <span className="pa-detail__option-seat" aria-hidden="true">
          {index + 1}
        </span>
        <span className="pa-detail__option-copy">
          <span className="pa-detail__option-label">{label}</span>
          <span className="pa-detail__option-desc">{description}</span>
        </span>
      </button>
    </div>
  )
}
