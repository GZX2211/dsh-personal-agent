// src/client/components/card/Badge.tsx
//
// 卡片头部那一个状态徽标：同一形状，色调按语义（进行中蓝、成功绿、警告黄、
// 失败红、其余中性）。

import type { ReactElement } from 'react'

export type BadgeTone = 'idle' | 'business' | 'success' | 'warn' | 'error'

export interface BadgeProps {
  tone: BadgeTone
  children: string
}

export function Badge({ tone, children }: BadgeProps): ReactElement {
  return (
    <span className="pa-badge" data-tone={tone}>
      {children}
    </span>
  )
}
