// src/client/components/ticket/LiveRow.tsx
//
// Live 行是状态而不是一次交接：每个运行中 Agent 在各自泳道画绿点，文案轮播当前活动。
// 等待审批时没有绿点，文案回到「等待审批 · 问题摘要」。

import { useEffect, useState, type CSSProperties, type ReactElement } from 'react'
import type { AgentLaneView, ChainRow, LiveRow as LiveRowData } from '../../../shared/ticket-detail.ts'
import type { Translate } from '../../i18n.ts'
import { laneX, liveItems, rowKindClass, waitingApprovalText, type LaneLayout } from '../../lib/chain.ts'

export interface LiveRowProps {
  t: Translate
  row: LiveRowData
  rows: readonly ChainRow[]
  lanes: readonly AgentLaneView[]
  layout: LaneLayout
  visibleLaneIds: ReadonlySet<string>
}

export function LiveRow({
  t,
  row,
  rows,
  lanes,
  layout,
  visibleLaneIds,
}: LiveRowProps): ReactElement {
  const items = liveItems(t, row, lanes, visibleLaneIds)
  const waiting = row.live === 'waiting-approval' ? waitingApprovalText(t, rows) : undefined
  const [index, setIndex] = useState(0)

  useEffect(() => {
    setIndex(0)
    if (waiting !== undefined || items.length <= 1 || prefersReducedMotion()) return
    const timer = setInterval(() => setIndex(current => (current + 1) % items.length), 3_500)
    return () => clearInterval(timer)
  }, [items.length, waiting])

  const liveAgents =
    row.liveAgents !== undefined && row.liveAgents.length > 0
      ? row.liveAgents
      : row.lane === undefined
        ? []
        : [{ lane: row.lane, ...(row.turn === undefined ? {} : { turn: row.turn }) }]
  const active = row.live === 'running' ? liveAgents.filter(agent => visibleLaneIds.has(agent.lane)) : []
  const style = { '--pa-rail-w': `${layout.railWidth}px` } as CSSProperties
  const height = 30

  return (
    <div className={`pa-chain pa-chain--live ${rowKindClass(row)}`} style={style}>
      <div className="pa-chain__row pa-chain__row--live">
        <div className="pa-chain__rail">
          <svg aria-hidden="true" viewBox={`0 0 ${layout.railWidth} ${height}`} preserveAspectRatio="none">
            {layout.lanes.map(lane => (
              <line
                key={lane.id}
                className="pa-rail__lane"
                x1={laneX(layout, lane.id)}
                y1={0}
                x2={laneX(layout, lane.id)}
                y2={height}
              />
            ))}
            {active.map(agent => {
              const x = laneX(layout, agent.lane)
              return x === undefined ? null : (
                <g key={agent.lane}>
                  <circle className="pa-rail__live-ring" cx={x} cy={height / 2} r={5.6} />
                  <circle className="pa-rail__live-core" cx={x} cy={height / 2} r={3} />
                </g>
              )
            })}
          </svg>
        </div>
        <div className="pa-chain__meta">
          {waiting === undefined ? (
            items.length === 0 ? (
              <span className="pa-live__text">{t('ticketLiveWaiting', { name: t('ticketLaneWorker') })}</span>
            ) : (
              <span className="pa-live__rotator">
                <span
                  className="pa-live__track"
                  style={{ transform: `translateY(-${index * 17}px)` }}
                  aria-live="polite"
                >
                  {items.map(item => (
                    <span key={item.lane} className="pa-live__item">
                      {item.text}
                    </span>
                  ))}
                </span>
              </span>
            )
          ) : (
            <span className="pa-live__text">{waiting}</span>
          )}
        </div>
      </div>
    </div>
  )
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
