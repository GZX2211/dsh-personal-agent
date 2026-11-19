// src/client/components/TicketCard.tsx
//
// 工单行：与审批行同一套列表行，但既没有展开态也没有动作。
// 首行是「工单 #短码 · 标题」，下面是更新时间与目标摘要（两行截断）。

import type { ReactElement } from 'react'
import type { TicketView } from '../../shared/tickets.ts'
import type { Translate } from '../i18n.ts'
import { formatTimestamp } from '../lib/format.ts'
import { ticketBadge } from '../lib/tickets.ts'
import { ListRow } from './ListRow.tsx'
import { ticketDotState, ticketTagTone } from './status.ts'

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
      title={`${t('ticketLabel')} #${ticket.shortId} \u00B7 ${ticket.title}`}
      status={{ tone: ticketTagTone(badge.tone), label: t(badge.labelKey), dot: ticketDotState(badge.tone) }}
      summary={ticket.goal}
      meta={<span className="pa-row__time">{formatTimestamp(language, ticket.updatedAt)}</span>}
    />
  )
}
