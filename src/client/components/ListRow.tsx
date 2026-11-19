// src/client/components/ListRow.tsx
//
// 审批与工单共用的三行列表行：
//   会话标题 / 工单标题        … 状态 Tag + 展开
//   题干 / 目标（单行，悬停看全文）
//   跳转会话 / 工单短码        … 时间
//
// 标题行不跳转、不出提示；悬停看完整内容只属于中间那一条摘要。展开内容由
// 调用方提供，字段不在这里裁剪。

import {
  Button,
  IconChevronDownOutlineRegular,
  Tag,
  Tooltip,
  type TagTone,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { ReactElement, ReactNode } from 'react'

export interface ListRowStatus {
  tone: TagTone
  label: string
}

export interface ListRowProps {
  /** 与 AnimatedRows.rowKeys 对应的稳定键。 */
  rowKey: string
  /** 第一行：会话标题或工单标题。 */
  title: string
  /** 第二行：题干或工单目标；截断时悬停显示全文。 */
  summary?: string
  /** 第三行左侧：跳转会话按钮或工单短码标签。 */
  action?: ReactNode
  /** 第三行右侧的时间。 */
  time: string
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
  summary,
  action,
  time,
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
        <div className="pa-row__body">
          <div className="pa-row__titleline">
            <h3 className="pa-row__title">{title}</h3>
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
          {summary === undefined ? null : (
            <Tooltip label={summary} side="top" delayMs={300} onlyWhenClipped>
              <p className="pa-row__summary">{summary}</p>
            </Tooltip>
          )}
          <div className="pa-row__footer">
            {action}
            <span className="pa-row__time">{time}</span>
          </div>
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
