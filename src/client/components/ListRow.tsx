// src/client/components/ListRow.tsx
//
// 审批与工单共用的列表行：官方 Tag 表达状态、StateDot 表达阶段、Button 承担
// 展开。折叠时只有一行摘要；展开内容由调用方提供，字段不在这里裁剪。

import {
  Button,
  IconChevronDownOutlineRegular,
  StateDot,
  Tag,
  Tooltip,
  type StateDotState,
  type TagTone,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { ReactElement, ReactNode } from 'react'

export interface ListRowStatus {
  tone: TagTone
  label: string
  dot: StateDotState
}

export interface ListRowProps {
  /** 与 AnimatedRows.rowKeys 对应的稳定键。 */
  rowKey: string
  title: string
  /** 标题行下方的单行元信息。 */
  meta: ReactNode
  /** 可选的第三行摘要（工单目标）。 */
  summary?: string
  status: ListRowStatus
  /** 传了 onToggle 才渲染展开按钮；工单行没有展开态。 */
  onToggle?: () => void
  expanded?: boolean
  toggleLabel?: string
  panelId?: string
  children?: ReactNode
}

export function ListRow({
  rowKey,
  title,
  meta,
  summary,
  status,
  onToggle,
  expanded = false,
  toggleLabel,
  panelId,
  children,
}: ListRowProps): ReactElement {
  const expandable = onToggle !== undefined
  return (
    <article
      className="pa-row"
      role="listitem"
      data-row-key={rowKey}
      data-expanded={expandable ? (expanded ? 'true' : 'false') : undefined}
    >
      <div className="pa-row__head">
        <span className="pa-row__leading" aria-hidden="true">
          <StateDot state={status.dot} />
        </span>
        <div className="pa-row__body">
          <Tooltip label={title} side="top" delayMs={300} onlyWhenClipped>
            <h3 className="pa-row__title">{title}</h3>
          </Tooltip>
          <div className="pa-row__meta">{meta}</div>
          {summary === undefined ? null : (
            <Tooltip label={summary} side="top" delayMs={300} onlyWhenClipped>
              <p className="pa-row__summary">{summary}</p>
            </Tooltip>
          )}
        </div>
        <div className="pa-row__aside">
          <Tag tone={status.tone} className="pa-row__status">
            {status.label}
          </Tag>
          {expandable ? (
            <Tooltip label={toggleLabel ?? ''} side="left">
              <Button
                className="pa-row__toggle"
                variant="ghost"
                size="sm"
                icon={<IconChevronDownOutlineRegular />}
                aria-expanded={expanded}
                aria-controls={expanded ? panelId : undefined}
                aria-label={toggleLabel}
                onClick={onToggle}
              />
            </Tooltip>
          ) : null}
        </div>
      </div>
      {expandable && expanded && panelId !== undefined ? (
        <div className="pa-row__detail" id={panelId}>
          {children}
        </div>
      ) : null}
    </article>
  )
}
