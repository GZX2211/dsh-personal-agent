// src/client/components/card/CardHeader.tsx
//
// 卡片头部：左侧 eyebrow（发起者 / 关联工单）与折叠态题干，右侧状态、时间与
// 折叠按钮。排版沿用官方 `.header`：eyebrow 11/16 tertiary，右上角 24px 图标。
// 折叠按钮本身就是官方的最小化按钮，只是图标语义换成展开/折叠。

import type { ReactElement, ReactNode } from 'react'
import { IconButton } from './IconButton.tsx'

export interface CardHeaderProps {
  /** eyebrow 内容：若干可点击的元信息。 */
  eyebrow: ReactNode
  /** 折叠态要显示的题干；展开态不传。 */
  title?: ReactNode
  titleId?: string
  /** 头部右侧的时间文本（创建时间或决定时间）。 */
  time: string
  /** 头部右侧的状态词，例如「已通过」。 */
  status?: ReactNode
  collapsed: boolean
  onToggle?: () => void
  toggleLabel?: string
}

export function CardHeader({
  eyebrow,
  title,
  titleId,
  time,
  status,
  collapsed,
  onToggle,
  toggleLabel,
}: CardHeaderProps): ReactElement {
  return (
    <header className="pa-card__header">
      <div className="pa-card__heading">
        <div className="pa-card__eyebrow">{eyebrow}</div>
        {title === undefined ? null : (
          <h2 className="pa-card__collapsed-title" id={titleId}>
            {title}
          </h2>
        )}
      </div>
      <div className="pa-card__header-actions">
        {status === undefined ? null : <span className="pa-card__status">{status}</span>}
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
