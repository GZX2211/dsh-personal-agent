// src/client/components/TicketCard.tsx
//
// 工单页的一张简略卡片（方案 §10.4）：阶段徽标、标题、相对时间、短码与执行会话、
// 一句话目标或汇报摘要，以及「阻塞中 / 已中断 / 排队中 / 结束结果」副标签。
// 不提供展开与跳转。

import type { ReactElement } from 'react'
import type { TicketView } from '../../shared/tickets.ts'
import type { Translate } from '../i18n.ts'
import { formatTime } from '../lib/format.ts'
import {
  outcomeKey,
  queueReasonKey,
  shortSession,
  stageBadgeKey,
  ticketPreview,
} from '../lib/tickets.ts'

export interface TicketCardProps {
  t: Translate
  ticket: TicketView
  now: number
  language: string
}

export function TicketCard({ t, ticket, now, language }: TicketCardProps): ReactElement {
  const tags: string[] = []
  if (ticket.stage === 'blocked') tags.push(t('ticketBlockedTag'))
  if (ticket.interrupted === true) tags.push(t('ticketInterruptedTag'))
  if (ticket.queueReason !== undefined) tags.push(t(queueReasonKey(ticket.queueReason)))
  if (ticket.stage === 'ended' && ticket.outcome !== undefined) tags.push(t(outcomeKey(ticket.outcome)))

  return (
    <article className="pa-ticket" data-stage={ticket.stage} data-outcome={ticket.outcome ?? 'none'}>
      <div className="pa-ticket__head">
        <span className="pa-ticket__stage">{t(stageBadgeKey(ticket.stage))}</span>
        <span className="pa-ticket__title">{ticket.title}</span>
        <span className="pa-ticket__time">{formatTime(t, language, now, ticket.updatedAt)}</span>
      </div>

      <div className="pa-ticket__meta">
        <span>#{ticket.shortId}</span>
        <span>
          {t('approvalRequester')} {t('roleRouter')}
        </span>
        {ticket.workerSessionId !== undefined ? (
          <span>
            {t('ticketWorkerLabel')} {shortSession(ticket.workerSessionId)}
          </span>
        ) : null}
      </div>

      <p className="pa-ticket__preview">{ticketPreview(ticket)}</p>

      {tags.length > 0 ? (
        <div className="pa-ticket__tags">
          {tags.map(tag => (
            <span key={tag} className="pa-ticket__tag">
              {tag}
            </span>
          ))}
        </div>
      ) : null}
    </article>
  )
}
