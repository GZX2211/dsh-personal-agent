// src/client/components/ListRow.tsx
//
// 审批与工单共用的三行列表行：
//   会话标题 / 工单标题        … 状态 Tag + 时间 + 展开
//   题干 / 目标（单行，悬停看全文）
//   跳转会话 / 工单短码
//
// 时间放在标题行右侧、状态徽标之后：与事件卡片同一位置，扫一眼就能按时间排序。
// 默认只显示相对时间，悬停给出完整时间。展开内容由调用方提供，字段不在这里裁剪。

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

export interface ListRowTime {
  /** 原始时间戳：只用于 `<time dateTime>` 的机器可读值。 */
  at: number
  /** 行上显示的相对时间（如「2小时前」）。 */
  label: string
  /** 悬停时显示的完整时间。 */
  detail: string
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
  /** 标题行右侧的时间：相对时间 + 悬停完整时间。 */
  time: ListRowTime
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
              <Tooltip label={time.detail} side="top" align="end">
                <time className="pa-row__time pa-row__time--inline" dateTime={new Date(time.at).toISOString()}>
                  {time.label}
                </time>
              </Tooltip>
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
          <div className="pa-row__footer">{action}</div>
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