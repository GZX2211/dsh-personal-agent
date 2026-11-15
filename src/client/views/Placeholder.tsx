// src/client/views/Placeholder.tsx
//
// 未开放标签页的统一占位：说清楚这里现在没有内容，而不是留一片空白。

import type { ReactElement } from 'react'

export interface PlaceholderProps {
  title: string
  hint: string
}

export function Placeholder({ title, hint }: PlaceholderProps): ReactElement {
  return (
    <div className="pa-console__placeholder">
      <strong>{title}</strong>
      <span className="pa-console__empty">{hint}</span>
    </div>
  )
}
