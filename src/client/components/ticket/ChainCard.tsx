// src/client/components/ticket/ChainCard.tsx
//
// 调用链卡片：标题行（调用链 / 过程·结构 / N 投递 · N 并行）→ 来源条 → 团队 →
// 泳道图 → 图例。
//
// 图是这一页的主角，所以这里全部自绘：官方原子只会在链里带进不属于它的行高与内边距。

import { useState, type CSSProperties, type ReactElement } from 'react'
import type { AgentLaneView, ChainRow, LiveRow, TicketDetailResponse } from '../../../shared/ticket-detail.ts'
import type { Translate } from '../../i18n.ts'
import { signalKindKey } from '../../lib/signals.ts'
import {
  formatClock,
  formatDuration,
  impactRows,
  laneColorHex,
  laneDisplayName,
  laneIndexLabel,
  laneState,
  liveText,
} from '../../lib/chain.ts'
import { ChainRowItem } from './ChainRowItem.tsx'

export interface ChainCardProps {
  t: Translate
  detail: TicketDetailResponse
  onOpenSession?: (sessionId: string) => void
  /** 测试与深链：初始选中某一行。 */
  initialSelectedId?: string
}

export function ChainCard({
  t,
  detail,
  onOpenSession,
  initialSelectedId,
}: ChainCardProps): ReactElement {
  const [selectedId, setSelectedId] = useState<string | undefined>(initialSelectedId)
  const { rows, lanes, origin, ticket } = detail
  const selected = rows.find(row => row.id === selectedId)
  const impact = selected === undefined ? [] : impactRows(rows, selected)
  const impactIds = new Set(impact.map(row => row.id))
  const live = rows.find((row): row is LiveRow => row.kind === 'live')
  const approved = rows.some(row => row.kind === 'approval' && row.phase === 'decision')
  const lastAt = rows.filter(row => row.kind !== 'live').reduce((latest, row) => Math.max(latest, row.at), 0)

  return (
    <section className="pa-card">
      <div className="pa-card__head">
        <h3 className="pa-card__title">{t('chainTitle')}</h3>
        <span className="pa-seg">
          <span className="pa-seg__item pa-seg__item--active">{t('chainModeProcess')}</span>
          <span className="pa-seg__item pa-seg__item--disabled" title={t('chainModeStructureHint')}>
            {t('chainModeStructure')}
          </span>
        </span>
        <span className="pa-detail__spacer" />
        <span className="pa-card__meta">
          {selected === undefined
            ? t('chainMeta', { hops: detail.metrics.hops, parallel: detail.metrics.parallel })
            : t('chainMetaSelected', { count: impact.length })}
        </span>
      </div>

      {origin.signal === undefined ? null : (
        <div className="pa-origin">
          <div className="pa-origin__top">
            <span className="pa-origin__kind">{t(signalKindKey(origin.signal.kind))}</span>
            <span className="pa-origin__text">{origin.signal.text ?? ''}</span>
            <span className="pa-time">{formatClock(origin.signal.receivedAt)}</span>
          </div>
          {origin.decision === undefined ? null : (
            <div className="pa-origin__sub">
              →{' '}
              <b>
                {formatClock(origin.decision.at)}{' '}
                {t(origin.decision.action === 'append' ? 'chainOriginAppend' : 'chainOriginDispatch')}
              </b>
            </div>
          )}
        </div>
      )}

      <div className="pa-team">
        {lanes.map(lane => (
          <Chip
            key={lane.id}
            t={t}
            lane={lane}
            ticket={ticket}
            approved={approved}
            {...(onOpenSession === undefined ? {} : { onOpenSession })}
          />
        ))}
      </div>

      {detail.completeness.logs === 'full' ? null : (
        <div className="pa-empty-line">{t('detailLogUnavailable')}</div>
      )}

      <div className="pa-graph">
        {rows.length === 0 ? (
          <div className="pa-empty-line">{t('detailEmptyChain')}</div>
        ) : (
          rows
            .filter(row => row.kind !== 'live')
            .map(row => (
              <ChainRowItem
                key={row.id}
                t={t}
                row={row}
                rows={rows}
                lanes={lanes}
                ticket={ticket}
                selected={row.id === selectedId}
                dim={selected !== undefined && row.at < selected.at}
                impacting={impactIds.has(row.id)}
                onToggle={() => setSelectedId(row.id === selectedId ? undefined : row.id)}
                {...(onOpenSession === undefined ? {} : { onOpenSession })}
              />
            ))
        )}
        {live === undefined ? null : (
          <LiveLine
            t={t}
            row={live}
            lane={lanes.find(lane => lane.id === live.lane)}
            elapsedMs={live.at - lastAt}
          />
        )}
      </div>

      <div className="pa-legend">
        <span>
          <span className="pa-legend__dot" aria-hidden="true" />
          {t('chainLegendDot')}
        </span>
        <span>{t('chainLegendArc')}</span>
        <span>{t('chainLegendReply')}</span>
      </div>
    </section>
  )
}

interface ChipProps {
  t: Translate
  lane: AgentLaneView
  ticket: TicketDetailResponse['ticket']
  approved: boolean
  onOpenSession?: (sessionId: string) => void
}

function Chip({ t, lane, ticket, approved, onOpenSession }: ChipProps): ReactElement {
  const state = laneState(t, lane, ticket, approved)
  const content = (
    <>
      <span className="pa-chip__index">{laneIndexLabel(lane)}</span>
      <span className="pa-chip__name">{laneDisplayName(t, lane)}</span>
      {state === undefined ? null : (
        <span className="pa-chip__state" data-state={state.state}>
          {state.label}
        </span>
      )}
    </>
  )
  const style = { '--c': laneColorHex(lane) } as CSSProperties
  if (lane.sessionId !== undefined && onOpenSession !== undefined) {
    return (
      <button type="button" className="pa-chip" style={style} onClick={() => onOpenSession(lane.sessionId as string)}>
        {content}
      </button>
    )
  }
  return (
    <span className="pa-chip" style={style}>
      {content}
    </span>
  )
}

function LiveLine({
  t,
  row,
  lane,
  elapsedMs,
}: {
  t: Translate
  row: LiveRow
  lane?: AgentLaneView
  elapsedMs: number
}): ReactElement {
  return (
    <div className="pa-live">
      <span className="pa-live__pulse" aria-hidden="true" />
      <span>{liveText(t, row, lane)}</span>
      {elapsedMs > 0 ? <span className="pa-time">{t('chainElapsed', { duration: formatDuration(t, elapsedMs) })}</span> : null}
    </div>
  )
}
