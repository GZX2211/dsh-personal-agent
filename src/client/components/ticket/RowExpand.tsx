// src/client/components/ticket/RowExpand.tsx
//
// 行内展开：保持上下文，不跳页。只展示这一条交接的 from → to、类型、完整时间、
// 全文与可打开的会话；不做影响树，也不展示「收到后做了什么」。

import { IconChevronRightOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ReactElement } from 'react'
import type {
  AgentLaneView,
  ChainRow,
  DispatchRow,
  HopRow,
  InterveneRow,
  SpawnRow,
  SupplementRow,
} from '../../../shared/ticket-detail.ts'
import type { ConsoleActions } from '../../actions.ts'
import type { Translate } from '../../i18n.ts'
import {
  formatFullTime,
  laneColor,
  laneName,
  rowKindClass,
  rowTypeKey,
} from '../../lib/chain.ts'

export interface RowExpandProps {
  t: Translate
  language: string
  row: ChainRow
  lanes: readonly AgentLaneView[]
  actions: ConsoleActions
  variant?: 'swim' | 'stream'
}

export function RowExpand({
  t,
  language,
  row,
  lanes,
  actions,
  variant = 'swim',
}: RowExpandProps): ReactElement | null {
  if (row.kind === 'milestone' || row.kind === 'live') return null

  const className = variant === 'stream' ? 'pa-stream__expand' : 'pa-chain__expand'
  const toNames =
    row.kind === 'fan'
      ? row.to.map(target => nameOf(target.sessionId, lanes, t)).join(' · ')
      : nameOf(row.to, lanes, t)
  const anchor = row.anchor
  const anchorTurn = anchor !== undefined && 'turn' in anchor ? anchor.turn : undefined
  const anchorText = [
    formatFullTime(language, row.at),
    ...(anchorTurn === undefined ? [] : [t('ticketLaneTurn', { turn: anchorTurn })]),
    ...(anchor?.seq === undefined ? [] : [t('ticketRowAnchor', { seq: anchor.seq })]),
  ].join(' · ')
  const sessions = endpointSessions(row, lanes, t)

  return (
    <div className={`${className} ${rowKindClass(row)}`}>
      <div className="pa-chain__expand-head">
        <span className="pa-chain__who" style={{ color: laneColor(row.from, lanes) }}>
          {nameOf(row.from, lanes, t)}
        </span>
        <span className="pa-chain__arrow" aria-hidden="true">
          <IconChevronRightOutlineRegular size={12} />
        </span>
        <span className="pa-chain__who">{toNames}</span>
        <span className="pa-chain__kind">{t(rowTypeKey(row))}</span>
        <span className="pa-chain__etime">{anchorText}</span>
      </div>

      {row.kind === 'fan' ? (
        <div className="pa-chain__quote">
          <p>{t('ticketRowFanSummary', { count: row.to.length })}</p>
          <ul className="pa-chain__targets">
            {row.to.map(target => (
              <li key={target.sessionId}>
                <span style={{ color: laneColor(target.sessionId, lanes) }}>
                  {nameOf(target.sessionId, lanes, t)}
                </span>
                {target.summary.length === 0 ? null : <span> · {target.summary}</span>}
              </li>
            ))}
          </ul>
        </div>
      ) : row.kind === 'approval' ? (
        <>
          <p className="pa-chain__quote">{row.summary}</p>
          {row.options === undefined || row.options.length === 0 ? null : (
            <div className="pa-chain__options">
              <span className="pa-chain__options-label">{t('ticketRowOptions')}</span>
              {row.options.map(option => (
                <span key={option} className="pa-chain__option">
                  {option}
                </span>
              ))}
            </div>
          )}
        </>
      ) : (
        <p className="pa-chain__quote">{textOf(row)}</p>
      )}

      {sessions.length === 0 ? null : (
        <div className="pa-chain__actions">
          {sessions.map(session => (
            <button
              key={session.id}
              type="button"
              className="pa-chain__action"
              onClick={() => actions.openSession(session.id)}
            >
              {t('ticketRowOpenSession', { name: session.name })}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function textOf(row: DispatchRow | SupplementRow | SpawnRow | HopRow | InterveneRow): string {
  return row.text !== undefined && row.text.length > 0 ? row.text : row.summary
}

function nameOf(id: string, lanes: readonly AgentLaneView[], t: Translate): string {
  const lane = lanes.find(item => item.id === id)
  return lane === undefined ? id : laneName(lane, t)
}

/** 两端里有真实会话的才给按钮；Router 与人没有会话。 */
function endpointSessions(
  row: ChainRow,
  lanes: readonly AgentLaneView[],
  t: Translate,
): { id: string; name: string }[] {
  if (row.kind === 'milestone' || row.kind === 'live') return []
  const ids = row.kind === 'fan' ? [row.from, ...row.to.map(target => target.sessionId)] : [row.from, row.to]
  const seen = new Set<string>()
  const sessions: { id: string; name: string }[] = []
  for (const id of ids) {
    if (seen.has(id)) continue
    seen.add(id)
    const lane = lanes.find(item => item.id === id)
    if (lane?.sessionId === undefined) continue
    sessions.push({ id: lane.sessionId, name: laneName(lane, t) })
    // 一张卡只放两个入口：普通交接是发送方 + 接收方；fan 取父级 + 第一个目标。
    if (sessions.length >= 2) break
  }
  return sessions
}
