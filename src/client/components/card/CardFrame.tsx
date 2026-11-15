// src/client/components/card/CardFrame.tsx
//
// 卡片外壳：官方提问卡的同一套表面（圆角、填充、发丝描边与投影）。
// 折叠属于外壳的状态：`data-collapsed` 让头部与题干切到 minimize 形态。
// 没有页脚的卡片（工单）底部由内边距自己收口，形态上仍是同一张卡。

import type { ReactElement, ReactNode } from 'react'

export interface CardFrameProps {
  collapsed: boolean
  labelledBy?: string
  /** 卡片没有页脚：底部内边距补足页脚占位的那一段。 */
  footerless?: boolean
  /** 从别处跳转过来时强调这一张。 */
  focused?: boolean
  children: ReactNode
}

export function CardFrame({ collapsed, labelledBy, footerless, focused, children }: CardFrameProps): ReactElement {
  return (
    <section
      className={footerless === true ? 'pa-card pa-card--footerless' : 'pa-card'}
      data-collapsed={collapsed || undefined}
      data-focused={focused || undefined}
      aria-labelledby={labelledBy}
    >
      {children}
    </section>
  )
}
