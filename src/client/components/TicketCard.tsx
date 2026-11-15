// src/client/components/TicketCard.tsx
//
// 工单卡：与审批卡同一张卡片、同一套头部；没有展开态，也没有动作按钮。
// 头部是「工单 #短码 · 标题」与右侧的一个状态徽标 + 更新时间，正文是这一单
// 的目标（最多两行，超出省略）。

import type { ReactElement } from 'react'
import type { TicketView } from '../../shared/tickets.ts'
import type { Translate } from '../i18n.ts'
import { formatTimestamp } from '../lib/format.ts'
import { ticketBadge } from '../lib/tickets.ts'
import { Badge } from './card/Badge.tsx'
import { CardFrame } from './card/CardFrame.tsx'
import { CardHeader } from './card/CardHeader.tsx'

export interface TicketCardProps {
  t: Translate
  language: string
  ticket: TicketView
}

export function TicketCard({ t, language, ticket }: TicketCardProps): ReactElement {
  const badge = ticketBadge(ticket)

  return (
    <CardFrame collapsed={false}>
      <CardHeader
        meta={
          <>
            <span className="pa-card__meta-item">{`${t('ticketLabel')} #${ticket.shortId}`}</span>
            <span className="pa-card__meta-item pa-card__meta-strong" title={ticket.title}>
              {ticket.title}
            </span>
          </>
        }
        time={formatTimestamp(language, ticket.updatedAt)}
        badge={<Badge tone={badge.tone}>{t(badge.labelKey)}</Badge>}
        collapsed={false}
      />

      <div className="pa-card__body">
        <h2 className="pa-card__question pa-card__question--clamp">{ticket.goal}</h2>
      </div>
    </CardFrame>
  )
}
