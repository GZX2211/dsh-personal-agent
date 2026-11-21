// src/client/views/TicketDetail.tsx
//
// 工单详情页：头部 → 调用链（主角）→ 交付卡 → 折叠的会话与目录。
//
// `TicketDetail` 负责取数（轮询），`TicketDetailView` 只消费一份详情：页面主体因此
// 可以在没有网络与计时器的环境里被渲染与检查。

import { useState, type ReactElement } from 'react'
import type { TicketDetailResponse } from '../../shared/ticket-detail.ts'
import type { ConsoleActions } from '../actions.ts'
import { NO_ACTIONS } from '../actions.ts'
import { ChainCard } from '../components/ticket/ChainCard.tsx'
import { DeliveryCard } from '../components/ticket/DeliveryCard.tsx'
import { TicketDetailHeader } from '../components/ticket/TicketDetailHeader.tsx'
import { useTicketDetail } from '../hooks/useTicketDetail.ts'
import type { Translate } from '../i18n.ts'
import { laneDisplayName, shortDirectory } from '../lib/chain.ts'

export interface TicketDetailViewProps {
  t: Translate
  detail: TicketDetailResponse
  onBack: () => void
  onOpenSession?: (sessionId: string) => void
  /** 测试与深链：初始展开某一行。 */
  initialSelectedId?: string
}

export function TicketDetailView({
  t,
  detail,
  onBack,
  onOpenSession,
  initialSelectedId,
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
        detail={detail}
        {...(onOpenSession === undefined ? {} : { onOpenSession })}
        {...(initialSelectedId === undefined ? {} : { initialSelectedId })}
      />
      <DeliveryCard t={t} detail={detail} />
      <SessionsFold t={t} detail={detail} />
    </div>
  )
}

export interface TicketDetailProps {
  t: Translate
  ticketId: string
  onBack: () => void
  actions?: ConsoleActions
}

/** 取数版：轮询详情，失败保留上一份，工单不存在时给出它自己的空态。 */
export function TicketDetail({ t, ticketId, onBack, actions = NO_ACTIONS }: TicketDetailProps): ReactElement {
  const { detail, error, errorCode, loading } = useTicketDetail(ticketId)

  if (detail === undefined) {
    return (
      <div className="pa-detail pa-detail--empty">
        <button type="button" className="pa-detail__back" aria-label={t('ticketDetailBack')} onClick={onBack}>
          {'‹'}
        </button>
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
      detail={detail}
      onBack={onBack}
      onOpenSession={sessionId => actions.openSession(sessionId)}
    />
  )
}

/** 会话与目录：链上的会话 id 对人不友好，这里给出名字与完整路径。 */
function SessionsFold({ t, detail }: { t: Translate; detail: TicketDetailResponse }): ReactElement {
  const [open, setOpen] = useState(false)
  const sessions = detail.lanes.filter(lane => lane.sessionId !== undefined)
  const directory = detail.ticket.directory
  const meta = [
    t('detailSessionsCount', { count: sessions.length }),
    shortDirectory(directory),
  ]
    .filter((part): part is string => part !== undefined && part.length > 0)
    .join(' · ')

  return (
    <div>
      <button type="button" className="pa-fold" aria-expanded={open} onClick={() => setOpen(current => !current)}>
        <span className="pa-fold__caret">{open ? '▾' : '▸'}</span>
        <span>{t('detailSessionsTitle')}</span>
        <span className="pa-detail__spacer" />
        <span className="pa-fold__mono">{meta}</span>
      </button>
      {open ? (
        <ul className="pa-fold__list">
          {sessions.map(lane => (
            <li className="pa-fold__item" key={lane.id}>
              <b>{laneDisplayName(t, lane)}</b>
              <span>{lane.sessionId}</span>
            </li>
          ))}
          {directory === undefined ? null : (
            <li className="pa-fold__item">
              <b>{t('detailWorkingDirectory')}</b>
              <span>{directory}</span>
            </li>
          )}
        </ul>
      ) : null}
    </div>
  )
}
