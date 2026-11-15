// src/client/components/card/CardHeader.tsx
//
// 卡片头部：左侧一行元信息（谁发起的 / 哪一单），右侧状态徽标、时间与折叠
// 按钮。元信息 12/16、时间 12/16，与主界面同一套小字刻度。
//
// 折叠态的题干不放在头部里：它要和工单卡的正文一样跨满整宽，否则头部右侧
// 的动作区会把文字挤成一窄列（上一版右侧那一块空白就是这么来的）。

import type { ReactElement, ReactNode } from 'react'
import { IconButton } from './IconButton.tsx'

export interface CardHeaderProps {
  /** 元信息：若干单行、可截断的片段（发起者会话、工单短码与标题）。 */
  meta: ReactNode
  /** 头部右侧的时间文本（创建时间或决定时间）。 */
  time: string
  /** 头部右侧的状态徽标。 */
  badge?: ReactNode
  collapsed: boolean
  onToggle?: () => void
  toggleLabel?: string
}

export function CardHeader({
  meta,
  time,
  badge,
  collapsed,
  onToggle,
  toggleLabel,
}: CardHeaderProps): ReactElement {
  return (
    <header className="pa-card__header">
      <div className="pa-card__meta">{meta}</div>
      <div className="pa-card__header-actions">
        {badge}
        <span className="pa-card__time">{time}</span>
        {onToggle === undefined ? null : (
          <IconButton
            icon={collapsed ? 'chevronDown' : 'chevronUp'}
            label={toggleLabel ?? ''}
            aria-expanded={!collapsed}
            onClick={onToggle}
          />
        )}
      </div>
    </header>
  )
}
