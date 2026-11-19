// src/client/components/card/CardFooter.tsx
//
// 详情页脚：左侧页数（本插件恒为一项），中间是校验/失败反馈，右侧是动作区。
// 只读态不传动作区，页脚只剩页数。

import type { ReactElement, ReactNode } from 'react'

export interface CardFooterProps {
  current: number
  total: number
  feedback?: string
  actions?: ReactNode
}

export function CardFooter({ current, total, feedback, actions }: CardFooterProps): ReactElement {
  return (
    <footer className="pa-detail__footer">
      <span className="pa-detail__progress">{`${current} / ${total}`}</span>
      <div className="pa-detail__feedback" role="status">
        {feedback ?? ''}
      </div>
      {actions === undefined ? null : <div className="pa-detail__actions">{actions}</div>}
    </footer>
  )
}
