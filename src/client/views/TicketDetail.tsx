// src/client/views/TicketDetail.tsx
//
// 工单详情页：头部 + 交接时间线 + 交付 + 会话目录。它覆盖同 tab 的列表，
// 返回时列表的胶囊与搜索词由父级保留，不在这里重新挂载。

import { useEffect, useRef, useState, type ReactElement } from 'react'
import type { ConsoleActions } from '../actions.ts'
import { DeliveryFold } from '../components/ticket/DeliveryFold.tsx'
import { SessionFold } from '../components/ticket/SessionFold.tsx'
import { SwimTimeline, type TimelineView } from '../components/ticket/SwimTimeline.tsx'
import { TicketDetailHeader } from '../components/ticket/TicketDetailHeader.tsx'
import { useTicketDetail } from '../hooks/useTicketDetail.ts'
import type { Translate } from '../i18n.ts'
import { ensureCoreLanes, handoffCount, laneName } from '../lib/chain.ts'

export interface TicketDetailProps {
  ticketId: string
  t: Translate
  language: string
  actions: ConsoleActions
  onBack: () => void
  /** 404：父级回列表并显示提示。 */
  onMissing: () => void
}

export function TicketDetail({
  ticketId,
  t,
  language,
  actions,
  onBack,
  onMissing,
}: TicketDetailProps): ReactElement {
  const { detail, error, loading, notFound, refresh } = useTicketDetail(ticketId, { onNotFound: onMissing })
  const scrollRef = useRef<HTMLDivElement>(null)
  const [selectedRowId, setSelectedRowId] = useState<string>()
  const [focusedLaneId, setFocusedLaneId] = useState<string>()
  const [view, setView] = useState<TimelineView>('swim')
  const [moreExpanded, setMoreExpanded] = useState(false)
  const [deliveryOpen, setDeliveryOpen] = useState(false)
  const [sessionOpen, setSessionOpen] = useState(false)
  const lastStage = useRef(detail?.ticket.stage)

  useEffect(() => {
    if (detail === undefined) return
    if (detail.ticket.stage === 'ended' && lastStage.current !== 'ended') {
      setDeliveryOpen(detail.delivery.report !== undefined)
    }
    lastStage.current = detail.ticket.stage
  }, [detail])

  const handoffs = detail === undefined ? 0 : handoffCount(detail.rows)
  const lanes = detail === undefined ? [] : ensureCoreLanes(detail.lanes, detail.ticket.workerSessionId)
  const owner = lanes.find(lane => lane.role === 'lead')
  const ownerName = owner === undefined ? t('ticketLaneWorker') : laneName(owner, t)

  const toggleRow = (rowId: string): void => {
    setSelectedRowId(current => (current === rowId ? undefined : rowId))
  }

  const focusLane = (laneId: string): void => {
    setFocusedLaneId(current => (current === laneId ? undefined : laneId))
  }

  return (
    <div className="pa-ticket-detail" ref={scrollRef}>
      {detail === undefined ? (
        <div className="pa-td__fallback-head">
          <button
            type="button"
            className="pa-td__back"
            aria-label={t('ticketDetailBack')}
            onClick={onBack}
          >
            ‹
          </button>
        </div>
      ) : null}

      {detail === undefined && loading ? (
        <div className="pa-td__state" role="status">
          {t('ticketDetailLoading')}
        </div>
      ) : null}

      {detail === undefined && error !== undefined ? (
        <div className="pa-td__state pa-td__state--error" role="alert">
          <p className="pa-td__state-title">{t('ticketDetailLoadFailed')}</p>
          <p className="pa-td__state-body">{error}</p>
          <button type="button" className="pa-td__retry" onClick={refresh}>
            {t('ticketDetailRetry')}
          </button>
        </div>
      ) : null}

      {notFound ? (
        <div className="pa-td__state" role="status">
          {t('ticketDetailNotFound')}
        </div>
      ) : null}

      {detail === undefined ? null : (
        <>
          <TicketDetailHeader
            t={t}
            language={language}
            detail={detail}
            handoffCount={handoffs}
            ownerName={ownerName}
            actions={actions}
            onBack={onBack}
          />

          {error === undefined ? null : (
            <div className="pa-td__notice" role="status">
              <span>{error}</span>
              <button type="button" className="pa-td__retry pa-td__retry--inline" onClick={refresh}>
                {t('ticketDetailRetry')}
              </button>
            </div>
          )}

          <SwimTimeline
            t={t}
            language={language}
            detail={detail}
            actions={actions}
            {...(selectedRowId === undefined ? {} : { selectedRowId })}
            onToggleRow={toggleRow}
            {...(focusedLaneId === undefined ? {} : { focusedLaneId })}
            onFocusLane={focusLane}
            view={view}
            onViewChange={setView}
            moreExpanded={moreExpanded}
            onToggleMore={() => setMoreExpanded(current => !current)}
            scrollRef={scrollRef}
          />

          <DeliveryFold
            t={t}
            language={language}
            detail={detail}
            handoffCount={handoffs}
            open={deliveryOpen}
            onToggle={() => setDeliveryOpen(current => !current)}
          />

          <SessionFold
            t={t}
            detail={detail}
            open={sessionOpen}
            onToggle={() => setSessionOpen(current => !current)}
          />
        </>
      )}
    </div>
  )
}
