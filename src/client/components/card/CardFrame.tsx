// src/client/components/card/CardFrame.tsx
//
// 卡片外壳：宿主面板里的一张列表卡片——12px 圆角、卡片底色与发丝描边。
// 折叠属于外壳的状态：`data-collapsed` 让头部切到「只有元信息 + 题干」的形态。

import type { ReactElement, ReactNode } from 'react'

export interface CardFrameProps {
  collapsed: boolean
  labelledBy?: string
  children: ReactNode
}

export function CardFrame({ collapsed, labelledBy, children }: CardFrameProps): ReactElement {
  return (
    <section className="pa-card" data-collapsed={collapsed || undefined} aria-labelledby={labelledBy}>
      {children}
    </section>
  )
}
