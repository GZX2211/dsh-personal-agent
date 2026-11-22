// src/client/components/ticket/FoldSection.tsx
//
// 详情页底部的折叠区：交付与会话目录共用同一个折叠头，保持相同的 28px 高度。

import type { ReactElement, ReactNode } from 'react'

export interface FoldSectionProps {
  id: string
  title: string
  subtitle?: string
  meta?: string
  open: boolean
  onToggle: () => void
  children: ReactNode
}

export function FoldSection({
  id,
  title,
  subtitle,
  meta,
  open,
  onToggle,
  children,
}: FoldSectionProps): ReactElement {
  return (
    <section className={`pa-fold${open ? ' pa-fold--open' : ''}`}>
      <button
        type="button"
        className="pa-fold__button"
        aria-expanded={open}
        aria-controls={id}
        onClick={onToggle}
      >
        <span className="pa-fold__caret" aria-hidden="true">
          ▸
        </span>
        <span className="pa-fold__title">{title}</span>
        {subtitle === undefined ? null : <span className="pa-fold__sub">{subtitle}</span>}
        <span className="pa-fold__spacer" />
        {meta === undefined ? null : <span className="pa-fold__meta">{meta}</span>}
      </button>
      {open ? (
        <div className="pa-fold__body" id={id}>
          {children}
        </div>
      ) : null}
    </section>
  )
}
