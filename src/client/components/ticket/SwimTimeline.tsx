// src/client/components/ticket/SwimTimeline.tsx
//
// 时间线卡：卡头、来源行、泳道标签、交接行 / 里程碑 / Live 行，以及手动切换的
// 事件流。布局全部由纯函数算出；这里只负责测量容器、滚动与交互。

import { useEffect, useRef, useState, type ReactElement, type RefObject } from 'react'
import type { LiveRow, TicketDetailResponse } from '../../../shared/ticket-detail.ts'
import type { ConsoleActions } from '../../actions.ts'
import type { Translate } from '../../i18n.ts'
import {
  computeLaneLayout,
  downstreamIdsOf,
  ensureCoreLanes,
  handoffCount,
  laneName,
  rowLanes,
  rowVisible,
} from '../../lib/chain.ts'
import { ChainRowItem } from './ChainRowItem.tsx'
import { LaneLabels } from './LaneLabels.tsx'
import { StreamTimeline } from './StreamTimeline.tsx'
import { TimelineOrigin } from './TimelineOrigin.tsx'

export type TimelineView = 'swim' | 'stream'

export interface SwimTimelineProps {
  t: Translate
  language: string
  detail: TicketDetailResponse
  actions: ConsoleActions
  selectedRowId?: string
  onToggleRow: (rowId: string) => void
  focusedLaneId?: string
  onFocusLane: (laneId: string) => void
  view: TimelineView
  onViewChange: (view: TimelineView) => void
  moreExpanded: boolean
  onToggleMore: () => void
  /** 详情页的纵向滚动容器：新行提示据此判断用户是否在底部。 */
  scrollRef: RefObject<HTMLElement | null>
}

export function SwimTimeline({
  t,
  language,
  detail,
  actions,
  selectedRowId,
  onToggleRow,
  focusedLaneId,
  onFocusLane,
  view,
  onViewChange,
  moreExpanded,
  onToggleMore,
  scrollRef,
}: SwimTimelineProps): ReactElement {
  const cardRef = useRef<HTMLElement>(null)
  const [cardWidth, setCardWidth] = useState(540)
  const [pendingRows, setPendingRows] = useState(0)
  const previousHandoffs = useRef<number | undefined>(undefined)

  useEffect(() => {
    const element = cardRef.current
    if (element === null || typeof ResizeObserver === 'undefined') return
    const measure = (): void => setCardWidth(element.getBoundingClientRect().width)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const liveRow = detail.rows.find((row): row is LiveRow => row.kind === 'live')
  const liveAgents = liveRow?.liveAgents
  const lanes = ensureCoreLanes(detail.lanes, detail.ticket.workerSessionId)
  const layout = computeLaneLayout({
    lanes,
    rows: detail.rows,
    ...(liveAgents === undefined ? {} : { liveAgents }),
    // 卡片左右各 12px 内边距；布局的 available 从内容宽度算起。
    cardWidth: Math.max(0, cardWidth - 24),
    expanded: moreExpanded,
  })
  const visibleLaneIds = new Set(layout.lanes.map(lane => lane.id))
  const handoffs = handoffCount(detail.rows)
  const visibleRows = detail.rows.filter(row => rowVisible(row, visibleLaneIds))
  const affected = new Set(selectedRowId === undefined ? [] : downstreamIdsOf(detail.rows, selectedRowId))
  const focused = lanes.find(lane => lane.id === focusedLaneId)

  useEffect(() => {
    const previous = previousHandoffs.current
    previousHandoffs.current = handoffs
    if (previous === undefined || handoffs <= previous) return
    if (isNearBottom(scrollRef.current)) return
    setPendingRows(count => count + handoffs - previous)
  }, [handoffs, scrollRef])

  useEffect(() => {
    const element = scrollRef.current
    if (element === null) return
    const onScroll = (): void => {
      if (isNearBottom(element)) setPendingRows(0)
    }
    element.addEventListener('scroll', onScroll, { passive: true })
    return () => element.removeEventListener('scroll', onScroll)
  }, [scrollRef])

  const jumpToLatest = (): void => {
    const element = scrollRef.current
    setPendingRows(0)
    if (element === null) return
    element.scrollTo({ top: element.scrollHeight, behavior: 'smooth' })
  }

  return (
    <section className="pa-timeline" ref={cardRef} aria-label={t('ticketTimelineTitle')}>
      <div className="pa-timeline__head">
        <span className="pa-timeline__title">{t('ticketTimelineTitle')}</span>
        {focused === undefined ? null : (
          <button
            type="button"
            className="pa-timeline__focus"
            title={t('ticketTimelineFocusClear')}
            aria-label={t('ticketTimelineFocusClear')}
            onClick={() => onFocusLane(focused.id)}
          >
            {t('ticketTimelineFocus', { name: laneName(focused, t) })}
          </button>
        )}
        <span className="pa-timeline__spacer" />
        <span className="pa-timeline__meta">
          {t('ticketTimelineMeta', { count: handoffs, parallel: detail.metrics.parallel })}
        </span>
        <div className="pa-timeline__view" role="tablist" aria-label={t('ticketTimelineTitle')}>
          <button
            type="button"
            role="tab"
            aria-selected={view === 'swim'}
            className="pa-timeline__view-tab"
            onClick={() => onViewChange('swim')}
          >
            {t('ticketTimelineSwim')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === 'stream'}
            className="pa-timeline__view-tab"
            onClick={() => onViewChange('stream')}
          >
            {t('ticketTimelineStream')}
          </button>
        </div>
      </div>

      <TimelineOrigin
        t={t}
        language={language}
        origin={detail.origin}
        fallbackText={detail.ticket.goal}
        fallbackAt={detail.ticket.createdAt}
      />

      {detail.completeness.logs === 'full' ? null : (
        <div className={`pa-timeline__banner pa-timeline__banner--${detail.completeness.logs}`} role="status">
          {t(
            detail.completeness.logs === 'unavailable'
              ? 'ticketTimelineLogsUnavailable'
              : 'ticketTimelineLogsPartial',
          )}
        </div>
      )}

      {view === 'swim' ? (
        <>
          <div className={`pa-swim${layout.overflow || moreExpanded ? ' pa-swim--wide' : ''}`}>
            <div className="pa-swim__scroll">
              <div className="pa-swim__inner" style={{ minWidth: `${layout.railWidth}px` }}>
                <LaneLabels
                  t={t}
                  layout={layout}
                  {...(focusedLaneId === undefined ? {} : { focusedLaneId })}
                  expanded={moreExpanded}
                  onFocus={onFocusLane}
                  onToggleMore={onToggleMore}
                />
                <div className="pa-swim__rows">
                  {visibleRows.length === 0 ? (
                    <div className="pa-timeline__empty">{t('ticketTimelineEmpty')}</div>
                  ) : (
                    visibleRows.map(row => {
                      const rowLaneIds = rowLanes(row)
                      return (
                        <ChainRowItem
                          key={row.id}
                          t={t}
                          language={language}
                          row={row}
                          rows={detail.rows}
                          lanes={lanes}
                          layout={layout}
                          visibleLaneIds={visibleLaneIds}
                          selected={selectedRowId === row.id}
                          affected={affected.has(row.id)}
                          dimmed={
                            focusedLaneId !== undefined &&
                            rowLaneIds.length > 0 &&
                            !rowLaneIds.includes(focusedLaneId)
                          }
                          actions={actions}
                          onToggle={onToggleRow}
                        />
                      )
                    })
                  )}
                </div>
              </div>
            </div>
            {pendingRows > 0 ? (
              <button type="button" className="pa-swim__newrows" onClick={jumpToLatest}>
                {t('ticketTimelineNewRows', { count: pendingRows })}
              </button>
            ) : null}
          </div>
          <div className="pa-timeline__legend">
            <span>
              <i className="pa-timeline__legend-dot" />
              {t('ticketTimelineLegendDot')}
            </span>
            <span>
              <i className="pa-timeline__legend-line" />
              {t('ticketTimelineLegendLine')}
            </span>
            <span>{t('ticketTimelineLegendHint')}</span>
          </div>
        </>
      ) : (
        <>
          <StreamTimeline
            t={t}
            language={language}
            rows={detail.rows}
            lanes={lanes}
            {...(selectedRowId === undefined ? {} : { selectedRowId })}
            actions={actions}
            onToggleRow={onToggleRow}
          />
          <div className="pa-timeline__legend">
            <span>{t('ticketStreamLegend')}</span>
          </div>
        </>
      )}
    </section>
  )
}

function isNearBottom(element: HTMLElement | null): boolean {
  if (element === null) return true
  return element.scrollHeight - element.scrollTop - element.clientHeight < 32
}
