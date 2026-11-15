// src/client/components/card/CardFrame.tsx
//
// 卡片外壳：官方提问卡的同一套表面（圆角、填充、发丝描边与投影）。
// 折叠属于外壳的状态：`data-collapsed` 让头部与题干切到 minimize 形态。

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
