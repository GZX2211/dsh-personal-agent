// src/client/components/ticket/ChainRowItem.tsx
//
// 调用链的一行：左侧是装饰性的 rail（点与连线），右侧是文案。
//
// 行本身是按钮：整行可点、可聚焦，展开内容就地渲染在行下方，不弹层也不跳页。
// rail 的 SVG 只是装饰（aria-hidden），读屏用户拿到的是标签、摘要与时间。

import { Button, Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import { useId, type ReactElement } from 'react'
import type {
  AgentLaneView,
  ChainRow,
} from '../../../shared/ticket-detail.ts'
import type { Translate } from '../../i18n.ts'
import {
  chainRowLabel,
  chainRowLink,
  chainRowSummary,
  chainRowTone,
  factsAfter,
  impactRows,
  laneColorHex,
  laneDisplayName,
  laneX,
  railWidth,
} from '../../lib/chain.ts'
import { formatTimestamp } from '../../lib/format.ts'
import { toneTagTone } from './tone.ts'

export interface ChainRowItemProps {
  t: Translate
  language: string
  row: ChainRow
  rows: readonly ChainRow[]
  lanes: readonly AgentLaneView[]
  expanded: boolean
  onToggle: () => void
  /** 定位到某个会话；缺省时不渲染定位按钮。 */
  onOpenSession?: (sessionId: string) => void
}

const ROW_HEIGHT: Record<ChainRow['kind'], number> = {
  milestone: 26,
  live: 30,
  dispatch: 34,
  supplement: 34,
  hop: 34,
  spawn: 34,
  fan: 50,
  approval: 34,
}

export function ChainRowItem({
  t,
  language,
  row,
  rows,
  lanes,
  expanded,
  onToggle,
  onOpenSession,
}: ChainRowItemProps): ReactElement {
  const panelId = useId()
  const laneById = new Map(lanes.map(lane => [lane.id, lane]))
  const link = chainRowLink(row)
  const primaryLane = laneById.get(link?.from ?? rowLaneId(row) ?? '')
  const color = primaryLane === undefined ? '#7C8698' : laneColorHex(primaryLane)
  const label = chainRowLabel(t, row)
  const target = connectedTargetName(t, row, laneById)
  const summary = chainRowSummary(row)
  const height = ROW_HEIGHT[row.kind]

  return (
    <div
      className={expanded ? 'pa-chain-row pa-chain-row--open' : 'pa-chain-row'}
      data-row-id={row.id}
      data-kind={row.kind}
    >
      <button
        type="button"
        className="pa-chain-row__hit"
        aria-expanded={expanded}
        aria-controls={expanded ? panelId : undefined}
        onClick={onToggle}
      >
        <ChainRail
          width={railWidth(lanes.length)}
          height={height}
          lanes={lanes}
          row={row}
          link={link}
          color={color}
        />
        <span className="pa-chain-row__text">
          <span className="pa-chain-row__label">
            <span className="pa-chain-row__name">{label}</span>
            {target === undefined ? null : (
              <span className="pa-chain-row__target">{target}</span>
            )}
            {row.kind === 'milestone' && row.detail !== undefined ? (
              <Tag tone={toneTagTone(chainRowTone(row))} className="pa-chain-row__badge">
                {row.detail}
              </Tag>
            ) : null}
            {row.kind === 'approval' && row.decision !== undefined ? (
              <Tag tone={toneTagTone(chainRowTone(row))} className="pa-chain-row__badge">
                {t(
                  row.decision === 'selected'
                    ? 'chainDecisionSelected'
                    : row.decision === 'answered'
                      ? 'chainDecisionAnswered'
                      : 'chainDecisionSkipped',
                )}
              </Tag>
            ) : null}
          </span>
          {summary === undefined ? null : <span className="pa-chain-row__summary">{summary}</span>}
        </span>
        <span className="pa-chain-row__time">{formatClock(row.at)}</span>
      </button>
      {expanded ? (
        <ChainRowDetail
          t={t}
          language={language}
          row={row}
          rows={rows}
          laneById={laneById}
          panelId={panelId}
          {...(onOpenSession === undefined ? {} : { onOpenSession })}
        />
      ) : null}
    </div>
  )
}

/** 落单的里程碑与等待行没有连线：点画在自己那条泳道上。 */
function rowLaneId(row: ChainRow): string | undefined {
  if (row.kind === 'milestone') return row.lane
  if (row.kind === 'live') return row.lane
  return undefined
}

function connectedTargetName(
  t: Translate,
  row: ChainRow,
  lanes: ReadonlyMap<string, AgentLaneView>,
): string | undefined {
  const link = chainRowLink(row)
  if (link === undefined) return undefined
  const names = link.to
    .map(id => lanes.get(id))
    .filter((lane): lane is AgentLaneView => lane !== undefined)
    .map(lane => laneDisplayName(t, lane))
  return names.length === 0 ? undefined : names.join(' / ')
}

interface ChainRailProps {
  width: number
  height: number
  lanes: readonly AgentLaneView[]
  row: ChainRow
  link?: { from: string; to: string[] }
  color: string
}

/**
 * rail 上的一行：起点与终点各画一个点，中间一条弧线。
 *
 * 弧线用二次贝塞尔而不是直线：平行与交叉的投递在同一屏里能分得开。
 */
function ChainRail({ width, height, lanes, row, link, color }: ChainRailProps): ReactElement {
  const indexOf = (id: string): number | undefined => {
    const index = lanes.findIndex(lane => lane.id === id)
    return index < 0 ? undefined : index
  }
  const y = height / 2
  const rowLane = rowLaneId(row)
  const dot = rowLane === undefined ? undefined : indexOf(rowLane)

  return (
    <svg className="pa-chain-row__rail" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      {link === undefined ? (
        <circle cx={dot === undefined ? laneX(0) : laneX(dot)} cy={y} r={3} fill={color} data-role="dot" />
      ) : (
        link.to.map(toId => {
          const from = indexOf(link.from)
          const to = indexOf(toId)
          if (from === undefined || to === undefined) return null
          const x1 = laneX(Math.min(from, to))
          const x2 = laneX(Math.max(from, to))
          const mid = (x1 + x2) / 2
          return (
            <g key={toId} data-role="link">
              <path
                d={`M ${x1} ${y} Q ${mid} ${y - 9} ${x2} ${y}`}
                fill="none"
                stroke={color}
                strokeWidth={1.25}
                strokeLinecap="round"
              />
              <circle cx={x1} cy={y} r={3} fill={color} data-role="dot" />
              <circle cx={x2} cy={y} r={3} fill={color} data-role="dot" />
            </g>
          )
        })
      )}
    </svg>
  )
}

interface ChainRowDetailProps {
  t: Translate
  language: string
  row: ChainRow
  rows: readonly ChainRow[]
  laneById: ReadonlyMap<string, AgentLaneView>
  panelId: string
  onOpenSession?: (sessionId: string) => void
}

function ChainRowDetail({
  t,
  language,
  row,
  rows,
  laneById,
  panelId,
  onOpenSession,
}: ChainRowDetailProps): ReactElement {
  const link = chainRowLink(row)
  const text = 'text' in row && typeof row.text === 'string' ? row.text : undefined
  const facts = factsAfter(rows, row)
  const impact = impactRows(rows, row)
  const from = link === undefined ? undefined : laneById.get(link.from)
  const to =
    link === undefined
      ? []
      : link.to
          .map(id => laneById.get(id))
          .filter((lane): lane is AgentLaneView => lane !== undefined)

  return (
    <div className="pa-chain-edge" id={panelId}>
      <div className="pa-chain-edge__meta">
        <span>
          {from === undefined ? '' : laneDisplayName(t, from)}
          {to.length === 0 ? '' : ` → ${to.map(lane => laneDisplayName(t, lane)).join(' / ')}`}
        </span>
        <span>{chainRowLabel(t, row)}</span>
        <span>{formatTimestamp(language, row.at)}</span>
        {row.anchor === undefined ? null : (
          <span>{t('edgeAt', { turn: row.anchor.turn ?? '-', step: row.anchor.step ?? '-', seq: row.anchor.seq ?? '-' })}</span>
        )}
      </div>
      {text === undefined ? null : <p className="pa-chain-edge__text">{text}</p>}
      <section className="pa-chain-edge__section">
        <h4>{t('edgeAfterFacts')}</h4>
        {facts.length === 0 ? (
          <p className="pa-chain-edge__empty">{t('edgeNoFacts')}</p>
        ) : (
          <ul>
            {facts.map(fact => (
              <li key={fact.id}>
                <span>{chainRowLabel(t, fact)}</span>
                {chainRowSummary(fact) === undefined ? null : <span>: {chainRowSummary(fact)}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="pa-chain-edge__section">
        <h4>{t('edgeImpact')}</h4>
        {impact.length === 0 ? (
          <p className="pa-chain-edge__empty">{t('edgeNoImpact')}</p>
        ) : (
          <ul>
            {impact.map(item => (
              <li key={item.id}>
                <span>{chainRowLabel(t, item)}</span>
                {chainRowSummary(item) === undefined ? null : <span>: {chainRowSummary(item)}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
      {onOpenSession === undefined ? null : (
        <div className="pa-chain-edge__actions">
          {from?.sessionId === undefined ? null : (
            <Button variant="ghost" size="sm" onClick={() => onOpenSession(from.sessionId as string)}>
              {t('edgeLocate', { name: laneDisplayName(t, from) })}
            </Button>
          )}
          {to.map(lane =>
            lane.sessionId === undefined ? null : (
              <Button
                key={lane.id}
                variant="ghost"
                size="sm"
                onClick={() => onOpenSession(lane.sessionId as string)}
              >
                {t('edgeLocate', { name: laneDisplayName(t, lane) })}
              </Button>
            ),
          )}
        </div>
      )}
    </div>
  )
}

/** 行右侧只放时刻：同一屏里的行按时间读，比再写一遍日期省地方。 */
function formatClock(at: number): string {
  const date = new Date(at)
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}
