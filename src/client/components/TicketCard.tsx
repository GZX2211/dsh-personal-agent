// src/client/components/TicketCard.tsx
//
// 工单行：与审批行同一套三行排版——标题（右侧状态徽标与相对时间）/ 目标 /
// 工单短码。没有展开态也没有动作。

import { Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ReactElement } from 'react'
import type { TicketView } from '../../shared/tickets.ts'
import type { Translate } from '../i18n.ts'
import { formatRelativeTime, formatTimestamp } from '../lib/format.ts'
import { ticketBadge } from '../lib/tickets.ts'
import { ListRow } from './ListRow.tsx'
import { ticketTagTone } from './status.ts'

export interface TicketCardProps {
  t: Translate
  language: string
  ticket: TicketView
  /** 渲染时刻：相对时间与测试用，缺省取当前时钟。 */
  now?: number
}

export function TicketCard({ t, language, ticket, now = Date.now() }: TicketCardProps): ReactElement {
  const badge = ticketBadge(ticket)

  return (
    <ListRow
      rowKey={ticket.id}
      title={ticket.title}
      summary={ticket.goal}
      time={{
        at: ticket.updatedAt,
        label: formatRelativeTime(t, language, ticket.updatedAt, now),
        detail: formatTimestamp(language, ticket.updatedAt),
      }}
      status={{ tone: ticketTagTone(badge.tone), label: t(badge.labelKey) }}
      action={
        <Tag tone="outline" className="pa-row__ref">
          {`${t('ticketLabel')} #${ticket.shortId}`}
        </Tag>
      }
    />
  )
}