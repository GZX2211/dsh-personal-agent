// src/client/views/TicketDetail.tsx
//
// 工单详情页：头部 → 调用链（主角）→ 交付卡 → 折叠的会话与目录。
//
// `TicketDetail` 负责取数（轮询），`TicketDetailView` 只消费一份详情：页面主体因此
// 可以在没有网络与计时器的环境里被渲染与检查。

import type { ReactElement } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { TicketDetailResponse } from '../../shared/ticket-detail.ts'
import type { ConsoleActions } from '../actions.ts'
import { NO_ACTIONS } from '../actions.ts'
import { ChainCard } from '../components/ticket/ChainCard.tsx'
import { DeliveryCard } from '../components/ticket/DeliveryCard.tsx'
import { TicketDetailHeader } from '../components/ticket/TicketDetailHeader.tsx'
import { useTicketDetail } from '../hooks/useTicketDetail.ts'
import type { Translate } from '../i18n.ts'
import { laneDisplayName } from '../lib/chain.ts'

export interface TicketDetailViewProps {
  t: Translate
  language: string
  detail: TicketDetailResponse
  onBack: () => void
  onOpenSession?: (sessionId: string) => void
  /** 测试与深链：初始展开某一行。 */
  initialExpandedId?: string
}

export function TicketDetailView({
  t,
  language,
  detail,
  onBack,
  onOpenSession,
  initialExpandedId,
}: TicketDetailViewProps): ReactElement {
  return (
    <div className="pa-detail">
      <TicketDetailHeader
        t={t}
        detail={detail}
        onBack={onBack}
        {...(onOpenSession === undefined ? {} : { onOpenSession })}
      />
      <ChainCard
        t={t}
        language={language}
        detail={detail}
        {...(onOpenSession === undefined ? {} : { onOpenSession })}
        {...(initialExpandedId === undefined ? {} : { initialExpandedId })}
      />
      <DeliveryCard t={t} detail={detail} />
      <SessionsFold t={t} detail={detail} />
    </div>
  )
}

export interface TicketDetailProps {
  t: Translate
  language: string
  ticketId: string
  onBack: () => void
  actions?: ConsoleActions
}

/** 取数版：轮询详情，失败保留上一份，工单不存在时给出它自己的空态。 */
export function TicketDetail({
  t,
  language,
  ticketId,
  onBack,
  actions = NO_ACTIONS,
}: TicketDetailProps): ReactElement {
  const { detail, error, errorCode, loading } = useTicketDetail(ticketId)

  if (detail === undefined) {
    return (
      <div className="pa-detail pa-detail--empty">
        <Button className="pa-detail__back" variant="ghost" size="sm" aria-label={t('ticketDetailBack')} onClick={onBack}>
          {'‹'}
        </Button>
        <p className="pa-detail__placeholder">
          {errorCode === 'ticket-not-found'
            ? t('ticketDetailNotFound')
            : loading
              ? t('ticketDetailLoading')
              : (error ?? t('ticketDetailLoading'))}
        </p>
      </div>
    )
  }

  return (
    <TicketDetailView
      t={t}
      language={language}
      detail={detail}
      onBack={onBack}
      onOpenSession={sessionId => actions.openSession(sessionId)}
    />
  )
}

/** 会话与目录：链上的会话 id 对人不友好，这里给出名字与工作目录。 */
function SessionsFold({ t, detail }: { t: Translate; detail: TicketDetailResponse }): ReactElement {
  const sessions = detail.lanes.filter(lane => lane.sessionId !== undefined)
  return (
    <details className="pa-detail__fold">
      <summary className="pa-detail__fold-title">
        {t('detailSessionsTitle')}
        {sessions.length === 0 ? null : <span className="pa-detail__fold-count">{sessions.length}</span>}
      </summary>
      <ul className="pa-detail__sessions">
        {sessions.map(lane => (
          <li className="pa-detail__session" key={lane.id}>
            <span className="pa-detail__session-name">{laneDisplayName(t, lane)}</span>
            <span className="pa-detail__session-id">{lane.sessionId}</span>
          </li>
        ))}
      </ul>
      {detail.ticket.directory === undefined ? null : (
        <div className="pa-detail__session">
          <span className="pa-detail__session-name">{t('detailWorkingDirectory')}</span>
          <span className="pa-detail__session-id">{detail.ticket.directory}</span>
        </div>
      )}
    </details>
  )
}
