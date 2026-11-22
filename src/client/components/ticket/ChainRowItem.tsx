// src/client/components/ticket/ChainRowItem.tsx
//
// 一条交接行：左侧 rail 画直线与节点，右侧只留类型徽标和简写时间。
// from → to、摘要与完整时间在悬停 tip 里；点击行就地展开，不打开第二个面板。

import { Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import type { CSSProperties, ReactElement } from 'react'
import type { AgentLaneView, ChainRow } from '../../../shared/ticket-detail.ts'
import type { ConsoleActions } from '../../actions.ts'
import type { Translate } from '../../i18n.ts'
import {
  formatClockTime,
  formatFullTime,
  laneColor,
  laneName,
  laneX,
  rowHeight,
  rowKindClass,
  rowTypeKey,
  visibleFanTargets,
  type LaneLayout,
} from '../../lib/chain.ts'
import { LiveRow } from './LiveRow.tsx'
import { RowExpand } from './RowExpand.tsx'

export interface ChainRowItemProps {
  t: Translate
  language: string
  row: ChainRow
  rows: readonly ChainRow[]
  lanes: readonly AgentLaneView[]
  layout: LaneLayout
  visibleLaneIds: ReadonlySet<string>
  selected: boolean
  affected: boolean
  dimmed: boolean
  actions: ConsoleActions
  onToggle: (rowId: string) => void
}

export function ChainRowItem(props: ChainRowItemProps): ReactElement {
  const { t, language, row, lanes, layout, selected, affected, dimmed, onToggle } = props

  if (row.kind === 'live') {
    return (
      <LiveRow
        t={t}
        row={row}
        rows={props.rows}
        lanes={lanes}
        layout={layout}
        visibleLaneIds={props.visibleLaneIds}
      />
    )
  }

  const expandable = row.kind !== 'milestone'
  const panelId = `pa-row-expand-${row.id.replace(/[^A-Za-z0-9_-]/g, '-')}`
  const classes = [
    'pa-chain',
    rowKindClass(row),
    row.kind === 'fan' ? 'pa-chain--fan' : row.kind === 'milestone' ? 'pa-chain--milestone' : '',
    selected ? 'pa-chain--selected' : '',
    affected ? 'pa-chain--affected' : '',
    dimmed ? 'pa-chain--dim' : '',
    expandable ? 'pa-chain--expandable' : '',
  ]
    .filter(Boolean)
    .join(' ')
  const style = { '--pa-rail-w': `${layout.railWidth}px` } as CSSProperties
  const tip = rowTip(row, lanes, t)
  const time = formatClockTime(row.at)
  const fullTime = formatFullTime(language, row.at)

  const content = (
    <span className="pa-chain__meta">
      <span className="pa-chain__kind" aria-label={t(rowTypeKey(row))}>
        {t(rowTypeKey(row))}
      </span>
      <Tooltip label={fullTime} side="top" align="end">
        <time
          className="pa-chain__time"
          dateTime={new Date(row.at).toISOString()}
          aria-label={fullTime}
        >
          {time}
        </time>
      </Tooltip>
    </span>
  )

  return (
    <div className={classes} style={style}>
      <Tooltip label={tip} side="top" delayMs={300} maxWidth={320}>
        {expandable ? (
          <button
            type="button"
            className="pa-chain__row"
            aria-expanded={selected}
            aria-controls={selected ? panelId : undefined}
            onClick={() => onToggle(row.id)}
            onKeyDown={event => {
              if (event.key === 'Escape' && selected) onToggle(row.id)
            }}
          >
            <span className="pa-chain__rail">
              <Rail row={row} lanes={lanes} layout={layout} visibleLaneIds={props.visibleLaneIds} />
            </span>
            {content}
          </button>
        ) : (
          <div className="pa-chain__row pa-chain__row--static">
            <span className="pa-chain__rail">
              <Rail row={row} lanes={lanes} layout={layout} visibleLaneIds={props.visibleLaneIds} />
            </span>
            {content}
          </div>
        )}
      </Tooltip>
      {selected && expandable ? (
        <div id={panelId}>
          <RowExpand
            t={t}
            language={language}
            row={row}
            lanes={lanes}
            actions={props.actions}
          />
        </div>
      ) : null}
    </div>
  )
}

function Rail({
  row,
  lanes,
  layout,
  visibleLaneIds,
}: {
  row: ChainRow
  lanes: readonly AgentLaneView[]
  layout: LaneLayout
  visibleLaneIds: ReadonlySet<string>
}): ReactElement {
  const height = rowHeight(row)
  const mid = height / 2
  return (
    <svg aria-hidden="true" viewBox={`0 0 ${layout.railWidth} ${height}`} preserveAspectRatio="none">
      {layout.lanes.map(lane => {
        const x = laneX(layout, lane.id)
        return x === undefined ? null : (
          <line key={lane.id} className="pa-rail__lane" x1={x} y1={0} x2={x} y2={height} />
        )
      })}

      {row.kind === 'milestone' ? (
        <MilestoneNode row={row} layout={layout} mid={mid} />
      ) : row.kind === 'live' ? null : (
        <Edge row={row} lanes={lanes} layout={layout} visibleLaneIds={visibleLaneIds} mid={mid} />
      )}
    </svg>
  )
}

function MilestoneNode({
  row,
  layout,
  mid,
}: {
  row: Extract<ChainRow, { kind: 'milestone' }>
  layout: LaneLayout
  mid: number
}): ReactElement | null {
  const x = row.lane === undefined ? undefined : laneX(layout, row.lane)
  return x === undefined ? null : <circle className="pa-rail__milestone" cx={x} cy={mid} r={3.6} />
}

function Edge({
  row,
  lanes,
  layout,
  visibleLaneIds,
  mid,
}: {
  row: Extract<ChainRow, { kind: 'dispatch' | 'supplement' | 'spawn' | 'hop' | 'fan' | 'approval' | 'intervene' }>
  lanes: readonly AgentLaneView[]
  layout: LaneLayout
  visibleLaneIds: ReadonlySet<string>
  mid: number
}): ReactElement | null {
  const fromX = laneX(layout, row.from)
  if (fromX === undefined) return null
  const targets = row.kind === 'fan' ? visibleFanTargets(row, visibleLaneIds) : [{ sessionId: row.to }]
  const dashed = row.kind === 'intervene'
  const hue = laneColor(row.from, lanes)

  return (
    <>
      <circle className="pa-rail__source" cx={fromX} cy={mid} r={3.3} fill={hue} />
      {targets.map(target => {
        const toX = laneX(layout, target.sessionId)
        if (toX === undefined) return null
        const right = toX > fromX
        const endX = toX + (right ? -8 : 8)
        const arrow = right
          ? `M ${toX - 14} ${mid - 4} L ${toX - 8} ${mid} L ${toX - 14} ${mid + 4} Z`
          : `M ${toX + 14} ${mid - 4} L ${toX + 8} ${mid} L ${toX + 14} ${mid + 4} Z`
        return (
          <g key={target.sessionId}>
            {toX !== fromX ? (
              <line
                className="pa-rail__edge"
                x1={fromX}
                y1={mid}
                x2={endX}
                y2={mid}
                stroke={hue}
                {...(dashed ? { strokeDasharray: '3 3' } : {})}
              />
            ) : null}
            <path d={arrow} fill={hue} opacity={0.95} />
            <rect
              className={`pa-rail__node${dashed ? ' pa-rail__node--dashed' : ''}`}
              x={toX - 8}
              y={mid - 8}
              width={16}
              height={16}
              rx={4}
            />
          </g>
        )
      })}
    </>
  )
}

function rowTip(row: ChainRow, lanes: readonly AgentLaneView[], t: Translate): string {
  const type = t(rowTypeKey(row))
  if (row.kind === 'milestone') {
    return [type, row.detail, formatFullTime('', row.at)].filter((part): part is string => part !== undefined).join(' · ')
  }
  if (row.kind === 'live') return [type, formatFullTime('', row.at)].join(' · ')

  const from = nameOf(row.from, lanes, t)
  const to =
    row.kind === 'fan'
      ? t('ticketRowFanTargets', { count: row.to.length })
      : nameOf(row.to, lanes, t)
  const summary =
    row.kind === 'fan' ? t('ticketRowFanSummary', { count: row.to.length }) : row.summary
  return [type, `${from} → ${to}`, summary, formatFullTime('', row.at)]
    .filter(part => part.length > 0)
    .join(' · ')
}

function nameOf(id: string, lanes: readonly AgentLaneView[], t: Translate): string {
  const lane = lanes.find(item => item.id === id)
  return lane === undefined ? id : laneName(lane, t)
}
