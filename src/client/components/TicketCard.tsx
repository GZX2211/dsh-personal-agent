// src/client/components/TicketCard.tsx
//
// 工单卡：与审批卡同一张卡片、同一套头部；没有展开态，也没有动作按钮。
// 头部是「工单 #短码 · 标题」与更新时间，主体是这一单的目标，下面是两个
// 副标签（阻塞中 / 已中断）。状态胶囊在页面顶部，卡片里不再重复徽标。

import type { ReactElement } from 'react'
import type { TicketView } from '../../shared/tickets.ts'
import type { Translate } from '../i18n.ts'
import { formatTimestamp } from '../lib/format.ts'
import { tagKey, ticketTags } from '../lib/tickets.ts'
import { CardFrame } from './card/CardFrame.tsx'
import { CardHeader } from './card/CardHeader.tsx'

export interface TicketCardProps {
  t: Translate
  language: string
  ticket: TicketView
  /** 从审批卡跳过来时高亮这一张，帮人一眼找到它。 */
  focused?: boolean
}

export function TicketCard({ t, language, ticket, focused }: TicketCardProps): ReactElement {
  const tags = ticketTags(ticket)

  return (
    <CardFrame collapsed={false} footerless focused={focused}>
      <CardHeader
        eyebrow={
          <>
            <span className="pa-card__eyebrow-text">{`${t('ticketLabel')} #${ticket.shortId}`}</span>
            <span className="pa-card__eyebrow-text">{ticket.title}</span>
          </>
        }
        time={formatTimestamp(language, ticket.updatedAt)}
        collapsed={false}
      />

      <div className="pa-card__body">
        <h2 className="pa-card__question">{ticket.goal}</h2>
        {tags.length === 0 ? null : (
          <div className="pa-card__tags">
            {tags.map(tag => (
              <span key={tag} className="pa-card__tag" data-tag={tag}>
                {t(tagKey(tag))}
              </span>
            ))}
          </div>
        )}
      </div>
    </CardFrame>
  )
}
