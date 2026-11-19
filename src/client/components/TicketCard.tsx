// src/client/components/TicketCard.tsx
//
// 工单行：与审批行同一套三行排版——标题 / 目标 / 工单短码 + 时间。
// 没有展开态也没有动作；状态用官方 Tag 表达。

import { Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ReactElement } from 'react'
import type { TicketView } from '../../shared/tickets.ts'
import type { Translate } from '../i18n.ts'
import { formatTimestamp } from '../lib/format.ts'
import { ticketBadge } from '../lib/tickets.ts'
import { ListRow } from './ListRow.tsx'
import { ticketTagTone } from './status.ts'

export interface TicketCardProps {
  t: Translate
  language: string
  ticket: TicketView
}

export function TicketCard({ t, language, ticket }: TicketCardProps): ReactElement {
  const badge = ticketBadge(ticket)

  return (
    <ListRow
      rowKey={ticket.id}
      title={ticket.title}
      summary={ticket.goal}
      time={formatTimestamp(language, ticket.updatedAt)}
      status={{ tone: ticketTagTone(badge.tone), label: t(badge.labelKey) }}
      action={
        <Tag tone="outline" className="pa-row__ref">
          {`${t('ticketLabel')} #${ticket.shortId}`}
        </Tag>
      }
    />
  )
}
