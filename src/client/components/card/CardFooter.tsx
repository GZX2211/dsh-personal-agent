// src/client/components/card/CardFooter.tsx
//
// 卡片页脚：左侧分页（官方 `1 / N` 与左右箭头，本插件恒为一项所以箭头禁用），
// 中间是校验/失败反馈，右侧是动作区。只读态不传动作区，页脚只剩分页。

import type { ReactElement, ReactNode } from 'react'
import { IconButton } from './IconButton.tsx'

export interface CardFooterProps {
  current: number
  total: number
  prevLabel: string
  nextLabel: string
  feedback?: string
  actions?: ReactNode
}

export function CardFooter({
  current,
  total,
  prevLabel,
  nextLabel,
  feedback,
  actions,
}: CardFooterProps): ReactElement {
  return (
    <footer className="pa-card__footer">
      <div className="pa-card__pager">
        <IconButton icon="chevronLeft" label={prevLabel} disabled />
        <span className="pa-card__progress">{`${current} / ${total}`}</span>
        <IconButton icon="chevronRight" label={nextLabel} disabled />
      </div>
      <div className="pa-card__feedback" role="status">
        {feedback ?? ''}
      </div>
      {actions === undefined ? null : <div className="pa-card__footer-actions">{actions}</div>}
    </footer>
  )
}
