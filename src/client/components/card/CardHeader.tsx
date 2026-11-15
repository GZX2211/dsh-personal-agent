// src/client/components/card/CardHeader.tsx
//
// 卡片头部：左侧一行元信息（谁发起的 / 哪一单）与折叠态题干，右侧状态徽标、
// 时间与折叠按钮。元信息 12/16、时间 12/16，与主界面同一套小字刻度。

import type { ReactElement, ReactNode } from 'react'
import { IconButton } from './IconButton.tsx'

export interface CardHeaderProps {
  /** 元信息：若干单行、可截断的片段（发起者会话、工单短码与标题）。 */
  meta: ReactNode
  /** 折叠态要显示的题干；展开态不传。 */
  title?: ReactNode
  titleId?: string
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
  title,
  titleId,
  time,
  badge,
  collapsed,
  onToggle,
  toggleLabel,
}: CardHeaderProps): ReactElement {
  return (
    <header className="pa-card__header">
      <div className="pa-card__heading">
        <div className="pa-card__meta">{meta}</div>
        {title === undefined ? null : (
          <h2 className="pa-card__collapsed-title" id={titleId}>
            {title}
          </h2>
        )}
      </div>
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
