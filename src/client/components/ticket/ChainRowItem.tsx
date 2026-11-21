// src/client/components/ticket/ChainRowItem.tsx
//
// 调用链的一行：左边 96px 的 rail 画泳道列与这条投递的弧线，右边是这一行的文字。
//
// 行解剖照 mockup：一行 = 「谁 → 谁 [做了什么] … 时间」+ 一句内容；里程碑行没有边，
// 只在 rail 上点一个点。整行是按钮，展开内容就地出现在行下方。
//
// 这里**不复用官方原子**：链的排版本就是自绘的（rail、徽标、行），用 Tag/Button
// 只会把官方控件的内边距和行高带进来，字与边界都对不齐。

import type { CSSProperties, ReactElement } from 'react'
import type { AgentLaneView, ChainRow } from '../../../shared/ticket-detail.ts'
import type { TicketView } from '../../../shared/tickets.ts'
import type { Translate } from '../../i18n.ts'
import {
  chainBadge,
  chainLinkColor,
  chainRowLink,
  chainRowSummary,
  factsAfter,
  formatClock,
  impactRows,
  laneColorHex,
  laneDisplayName,
  laneX,
  ROUTER_COLOR,
  ROUTER_X,
  rowHeight,
  RAIL_WIDTH,
  type ChainBadge,
} from '../../lib/chain.ts'

export interface ChainRowItemProps {
  t: Translate
  row: ChainRow
  rows: readonly ChainRow[]
  lanes: readonly AgentLaneView[]
  ticket: TicketView
  selected: boolean
  /** 选中行之前的行淡化：链是从上往下读的。 */
  dim: boolean
  /** 这一行在选中行的推断影响范围里。 */
  impacting: boolean
  onToggle: () => void
  onOpenSession?: (sessionId: string) => void
}

export function ChainRowItem({
  t,
  row,
  rows,
  lanes,
  selected,
  dim,
  impacting,
  onToggle,
  onOpenSession,
}: ChainRowItemProps): ReactElement | null {
  if (row.kind === 'live') return null

  const laneById = new Map(lanes.map(lane => [lane.id, lane]))
  const link = chainRowLink(row)
  const fromLane = link === undefined ? undefined : laneById.get(link.from)
  const toLanes =
    link === undefined
      ? []
      : link.to
          .map(id => laneById.get(id))
          .filter((lane): lane is AgentLaneView => lane !== undefined)
  const fromColor = fromLane === undefined ? ROUTER_COLOR : laneColorHex(fromLane)
  const height = rowHeight(row.kind)
  const milestone = row.kind === 'milestone' || row.kind === 'dispatch'
  const badge = chainBadge(t, row)
  const summary = chainRowSummary(row)
  const rowClass = ['pa-graph__row', selected ? 'pa-graph__row--sel' : '', dim ? 'pa-graph__row--dim' : '']
    .filter(part => part.length > 0)
    .join(' ')

  return (
    <div className="pa-graph__row-wrap">
      <button type="button" className="pa-graph__hit" aria-expanded={selected} onClick={onToggle}>
        <div className={rowClass} style={{ height }}>
          <Rail
            row={row}
            lanes={lanes}
            height={height}
            fromX={fromLane === undefined ? ROUTER_X : laneX(fromLane.index)}
            fromId={link?.from}
            targets={toLanes.map(lane => laneX(lane.index))}
            color={chainLinkColor(row, fromColor)}
            dotColor={fromLane === undefined ? ROUTER_COLOR : laneColorHex(fromLane)}
          />
          <div className="pa-graph__txt">
            {milestone ? (
              <MilestoneLine t={t} row={row} />
            ) : (
              <HopLine
                t={t}
                row={row}
                badge={badge}
                summary={summary}
                fromLane={fromLane}
                toLanes={toLanes}
                impacting={impacting}
              />
            )}
          </div>
        </div>
      </button>
      {selected ? (
        <EdgeDetail
          t={t}
          row={row}
          rows={rows}
          lanes={lanes}
          fromLane={fromLane}
          toLanes={toLanes}
          onOpenSession={onOpenSession}
        />
      ) : null}
    </div>
  )
}

interface HopLineProps {
  t: Translate
  row: ChainRow
  badge?: ChainBadge
  summary?: string
  fromLane?: AgentLaneView
  toLanes: readonly AgentLaneView[]
  impacting: boolean
}

function HopLine({ t, row, badge, summary, fromLane, toLanes, impacting }: HopLineProps): ReactElement {
  return (
    <>
      <div className="pa-hop-top">
        <span
          className="pa-who"
          style={{ '--c': fromLane === undefined ? ROUTER_COLOR : laneColorHex(fromLane) } as CSSProperties}
        >
          {fromLane === undefined ? t('chainWhoRouter') : laneDisplayName(t, fromLane)}
        </span>
        <span className="pa-arw">{row.kind === 'fan' ? '⇉' : '→'}</span>
        {row.kind === 'fan' ? (
          <span>{t('chainFanTarget', { count: row.to.length })}</span>
        ) : (
          toLanes.map(lane => (
            <span key={lane.id} className="pa-who" style={{ '--c': laneColorHex(lane) } as CSSProperties}>
              {laneDisplayName(t, lane)}
            </span>
          ))
        )}
        {badge === undefined ? null : (
          <span className={badge.tone === 'plain' ? 'pa-kind' : `pa-kind pa-kind--${badge.tone}`}>
            {badge.label}
          </span>
        )}
        {impacting ? <span className="pa-impact">{t('chainImpact')}</span> : null}
        <span className="pa-time">{formatClock(row.at)}</span>
      </div>
      {summary === undefined || summary.length === 0 ? null : <div className="pa-graph__sum">{summary}</div>}
    </>
  )
}

function MilestoneLine({ t, row }: { t: Translate; row: ChainRow }): ReactElement {
  const closed = row.kind === 'milestone' && row.milestone === 'closed'
  const failed = row.kind === 'milestone' && row.milestone === 'failed'
  const dotStyle = closed
    ? ({ background: 'var(--dsw-alias-state-success-primary)', borderColor: 'var(--dsw-alias-state-success-primary)' } as CSSProperties)
    : failed
      ? ({ background: 'var(--dsw-alias-state-error-primary)', borderColor: 'var(--dsw-alias-state-error-primary)' } as CSSProperties)
      : undefined
  const label =
    row.kind === 'dispatch'
      ? `${t('chainBrief')} · ${row.summary}`
      : row.kind === 'milestone'
        ? `${t(milestoneKey(row.milestone))}${row.detail === undefined ? '' : ` · ${row.detail}`}`
        : ''
  return (
    <div className="pa-ms">
      <span className="pa-ms__dot" style={dotStyle} />
      <span className="pa-ms__label">{label}</span>
      <span className="pa-time">{formatClock(row.at)}</span>
    </div>
  )
}

function milestoneKey(kind: Extract<ChainRow, { kind: 'milestone' }>['milestone']): Parameters<Translate>[0] {
  switch (kind) {
    case 'queued':
      return 'chainMilestoneQueued'
    case 'queue-busy':
      return 'chainMilestoneQueueBusy'
    case 'queue-capacity':
      return 'chainMilestoneQueueCapacity'
    case 'interrupted':
      return 'chainMilestoneInterrupted'
    case 'resumed':
      return 'chainMilestoneResumed'
    case 'approval-discarded':
      return 'chainMilestoneApprovalDiscarded'
    case 'closed':
      return 'chainMilestoneClosed'
    case 'failed':
      return 'chainMilestoneFailed'
  }
}

interface RailProps {
  row: ChainRow
  lanes: readonly AgentLaneView[]
  height: number
  fromX: number
  fromId?: string
  targets: readonly number[]
  color: string
  dotColor: string
}

/**
 * rail：先铺所有泳道列（每行都铺，纵向扫下去就是泳道），再画这一行的点与弧线。
 *
 * 里程碑没有边：只在它所属的泳道点一个点。
 */
function Rail({ row, lanes, height, fromX, fromId, targets, color, dotColor }: RailProps): ReactElement {
  const markerId = `pa-arrow-${row.id.replace(/[^A-Za-z0-9_-]/g, '-')}`
  const milestone = row.kind === 'milestone' || row.kind === 'dispatch'
  const y = milestone ? height / 2 : 7

  return (
    <div className="pa-rail">
      <svg width={RAIL_WIDTH} height={height} aria-hidden="true">
        <defs>
          <marker id={markerId} markerWidth={5} markerHeight={5} refX={4} refY={2.5} orient="auto">
            <path d="M0,0 L5,2.5 L0,5 Z" fill={color} />
          </marker>
        </defs>
        {lanes.map(lane => (
          <line
            key={lane.id}
            x1={laneX(lane.index)}
            y1={0}
            x2={laneX(lane.index)}
            y2={height}
            stroke={laneColorHex(lane)}
            strokeOpacity={0.2}
            strokeWidth={1}
          />
        ))}
        {milestone || targets.length === 0 ? (
          <circle
            cx={targets[0] ?? laneX(lanes[0]?.index ?? 0)}
            cy={y}
            r={3}
            fill="none"
            stroke={color}
            strokeWidth={1.2}
            opacity={0.9}
          />
        ) : (
          <>
            <circle cx={fromX} cy={y} r={3} fill={dotColor} />
            {targets.map(target => (
              <path
                key={target}
                d={`M${fromX} ${y} C${fromX} ${height * 0.55}, ${target} ${height * 0.5}, ${target} ${height - 7}`}
                fill="none"
                stroke={color}
                strokeWidth={1.3}
                markerEnd={`url(#${markerId})`}
              />
            ))}
          </>
        )}
      </svg>
    </div>
  )
}

interface EdgeDetailProps {
  t: Translate
  row: ChainRow
  rows: readonly ChainRow[]
  lanes: readonly AgentLaneView[]
  fromLane?: AgentLaneView
  toLanes: readonly AgentLaneView[]
  onOpenSession?: (sessionId: string) => void
}

function EdgeDetail({ t, row, rows, lanes, fromLane, toLanes, onOpenSession }: EdgeDetailProps): ReactElement {
  const laneById = new Map(lanes.map(lane => [lane.id, lane]))
  const badge = chainBadge(t, row)
  const text = 'text' in row && typeof row.text === 'string' ? row.text : undefined
  const facts = factsAfter(rows, row)
  const impact = impactRows(rows, row)
  const anchor = row.anchor
  const metaParts: string[] = []
  if (anchor?.turn !== undefined) metaParts.push(t('edgeRound', { turn: anchor.turn }))
  if (anchor?.seq !== undefined) metaParts.push(`seq ${anchor.seq}`)

  return (
    <div className="pa-edge">
      <div className="pa-edge__head">
        <span
          className="pa-who"
          style={{ '--c': fromLane === undefined ? ROUTER_COLOR : laneColorHex(fromLane) } as CSSProperties}
        >
          {fromLane === undefined ? t('chainWhoRouter') : laneDisplayName(t, fromLane)}
        </span>
        <span className="pa-arw">→</span>
        {toLanes.map(lane => (
          <span key={lane.id} className="pa-who" style={{ '--c': laneColorHex(lane) } as CSSProperties}>
            {laneDisplayName(t, lane)}
          </span>
        ))}
        {badge === undefined ? null : (
          <span className={badge.tone === 'plain' ? 'pa-kind' : `pa-kind pa-kind--${badge.tone}`}>
            {badge.label}
          </span>
        )}
        {metaParts.length === 0 ? null : <span className="pa-edge__meta">· {metaParts.join(' · ')}</span>}
        <span className="pa-time">{formatClock(row.at)}</span>
      </div>
      {text === undefined ? null : <p className="pa-edge__quote">{text}</p>}
      <div className="pa-edge__sub">{t('edgeAfterFacts')}</div>
      {facts.length === 0 ? (
        <div className="pa-edge__empty">{t('edgeNoFacts')}</div>
      ) : (
        <div className="pa-edge__list">
          {facts.map(fact => (
            <div className="pa-edge__li" key={fact.id}>
              <em>{formatClock(fact.at)}</em>
              <span>{factText(t, fact, laneById)}</span>
            </div>
          ))}
        </div>
      )}
      <div className="pa-edge__sub">{t('edgeImpact', { count: impact.length })}</div>
      {impact.length === 0 ? (
        <div className="pa-edge__empty">{t('edgeNoImpact')}</div>
      ) : (
        <div className="pa-edge__tree">
          {impact.map((item, index) => (
            <div key={item.id} className={index === 0 ? 'pa-edge__tree-item' : 'pa-edge__tree-indent'}>
              {index === 0 ? <span className="pa-edge__tree-dot" /> : '↳ '}
              {impactText(t, item, laneById)}
            </div>
          ))}
        </div>
      )}
      {onOpenSession === undefined ? null : (
        <div className="pa-edge__actions">
          {fromLane?.sessionId === undefined ? null : (
            <button
              type="button"
              className="pa-edge__action"
              onClick={() => onOpenSession(fromLane.sessionId as string)}
            >
              {t('edgeLocate', { name: laneDisplayName(t, fromLane) })}
            </button>
          )}
          {toLanes.map(lane =>
            lane.sessionId === undefined ? null : (
              <button
                type="button"
                key={lane.id}
                className="pa-edge__action"
                onClick={() => onOpenSession(lane.sessionId as string)}
              >
                {t('edgeLocate', { name: laneDisplayName(t, lane) })}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  )
}

/** 「收到后它做了什么」的一条：动作 + 目标 + 摘要。 */
function factText(t: Translate, row: ChainRow, laneById: ReadonlyMap<string, AgentLaneView>): string {
  if (row.kind === 'approval') return t('edgeFactApproval', { summary: row.summary })
  const badge = chainBadge(t, row)
  const link = chainRowLink(row)
  const targets =
    link === undefined
      ? []
      : link.to
          .map(id => laneById.get(id))
          .filter((lane): lane is AgentLaneView => lane !== undefined)
          .map(lane => laneDisplayName(t, lane))
  const target = targets.join(' / ')
  const summary = chainRowSummary(row) ?? ''
  if (badge === undefined) return summary
  if (target.length === 0) return summary.length === 0 ? badge.label : `${badge.label}：${summary}`
  return summary.length === 0
    ? t('edgeFactTo', { action: badge.label, target })
    : t('edgeFactToSummary', { action: badge.label, target, summary })
}

/** 影响范围的一条：A → B · 动作 · 时间。 */
function impactText(t: Translate, row: ChainRow, laneById: ReadonlyMap<string, AgentLaneView>): string {
  const link = chainRowLink(row)
  if (row.kind === 'approval') return t('edgeFactApproval', { summary: row.summary })
  if (link === undefined) return chainRowSummary(row) ?? ''
  const from = laneById.get(link.from)
  const to = link.to
    .map(id => laneById.get(id))
    .filter((lane): lane is AgentLaneView => lane !== undefined)
    .map(lane => laneDisplayName(t, lane))
  const badge = chainBadge(t, row)
  return t('edgeImpactLine', {
    from: from === undefined ? t('chainWhoRouter') : laneDisplayName(t, from),
    target: to.join(' / '),
    action: badge?.label ?? '',
    time: formatClock(row.at),
  })
}
