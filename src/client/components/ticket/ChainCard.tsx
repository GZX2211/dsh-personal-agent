// src/client/components/ticket/ChainCard.tsx
//
// 调用链卡片：来源条 → 团队 chips → 泳道链 → 图例。
//
// 链是这一页的主角，因此它自己承担「谁把什么交给了谁」的叙述：每一行是一按钮，
// 展开后就地给出全文、收到后的事实与可能的影响范围。团队 chips 是导航，不是装饰：
// 点一下就跳到那个 Agent 的会话。

import { Button, Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import { useState, type CSSProperties, type ReactElement } from 'react'
import type {
  AgentLaneView,
  ChainRow,
  TicketDetailResponse,
} from '../../../shared/ticket-detail.ts'
import type { Translate } from '../../i18n.ts'
import { signalKindKey } from '../../lib/signals.ts'
import { laneColorHex, laneDisplayName, laneIndexLabel } from '../../lib/chain.ts'
import { ChainRowItem } from './ChainRowItem.tsx'

export interface ChainCardProps {
  t: Translate
  language: string
  detail: TicketDetailResponse
  /** 定位到某个会话；缺省时 chips 只读。 */
  onOpenSession?: (sessionId: string) => void
  /** 测试与深链：初始展开某一行。 */
  initialExpandedId?: string
}

export function ChainCard({
  t,
  language,
  detail,
  onOpenSession,
  initialExpandedId,
}: ChainCardProps): ReactElement {
  const [expandedId, setExpandedId] = useState<string | undefined>(initialExpandedId)
  const { rows, lanes, origin } = detail
  const signal = origin.signal
  const decision = origin.decision

  return (
    <section className="pa-chain" aria-label={t('chainTitle')}>
      <div className="pa-chain__head">
        <h3 className="pa-chain__title">{t('chainTitle')}</h3>
        <span className="pa-chain__meta">
          {t('chainMeta', {
            hops: detail.metrics.hops,
            supplements: detail.metrics.supplements,
          })}
        </span>
      </div>

      {signal === undefined && decision === undefined ? null : (
        <div className="pa-chain__origin">
          <div className="pa-chain__origin-line">
            {signal === undefined ? null : (
              <>
                <Tag tone="neutral" className="pa-chain__origin-kind">
                  {t(signalKindKey(signal.kind))}
                </Tag>
                <span className="pa-chain__origin-text">{signal.text ?? ''}</span>
                <span className="pa-chain__stamp">{clock(signal.receivedAt)}</span>
              </>
            )}
          </div>
          {decision === undefined ? null : (
            <div className="pa-chain__origin-line pa-chain__origin-line--decision">
              <span className="pa-chain__arrow" aria-hidden="true">
                ↳
              </span>
              <span className="pa-chain__origin-text">
                {t(decision.action === 'append' ? 'chainAppend' : decision.action === 'supplement' ? 'chainSupplement' : 'chainDispatch')}
              </span>
              <span className="pa-chain__stamp">{clock(decision.at)}</span>
            </div>
          )}
        </div>
      )}

      <div className="pa-chain__lanes" role="list" aria-label={t('detailSessionsTitle')}>
        {lanes.map(lane => (
          <LaneChip key={lane.id} t={t} lane={lane} {...(onOpenSession === undefined ? {} : { onOpenSession })} />
        ))}
      </div>

      {detail.completeness.logs === 'full' ? null : (
        <p className="pa-chain__notice">{t('chainLogsUnavailable')}</p>
      )}

      <div className="pa-chain__rows" role="list" aria-label={t('chainTitle')}>
        {rows.length === 0 ? (
          <p className="pa-chain__empty">
            {detail.ticket.stage === 'queued' ? t('detailQueued') : t('chainEmpty')}
          </p>
        ) : (
          rows.map(row => {
            const expanded = row.id === expandedId
            return (
              <ChainRowGate
                key={row.id}
                t={t}
                language={language}
                row={row}
                rows={rows}
                lanes={lanes}
                expanded={expanded}
                onToggle={() => setExpandedId(expanded ? undefined : row.id)}
                {...(onOpenSession === undefined ? {} : { onOpenSession })}
              />
            )
          })
        )}
      </div>

      <p className="pa-chain__legend">{t('chainLegend')}</p>
    </section>
  )
}

function ChainRowGate(props: Parameters<typeof ChainRowItem>[0]): ReactElement {
  return (
    <div role="listitem">
      <ChainRowItem {...props} />
    </div>
  )
}

interface LaneChipProps {
  t: Translate
  lane: AgentLaneView
  onOpenSession?: (sessionId: string) => void
}

function LaneChip({ t, lane, onOpenSession }: LaneChipProps): ReactElement {
  const color = laneColorHex(lane)
  const name = laneDisplayName(t, lane)
  const content = (
    <>
      <span className="pa-chip__index" aria-hidden="true">
        {laneIndexLabel(lane)}
      </span>
      <span className="pa-chip__name">{name}</span>
      {lane.status === 'running' && lane.currentTurn !== undefined ? (
        <span className="pa-chip__state" data-state="running">
          {t('chainLiveRunning', { turn: lane.currentTurn })}
        </span>
      ) : null}
    </>
  )
  const style = { '--pa-lane-color': color } as CSSProperties
  return (
    <span className="pa-chip-slot" role="listitem">
      {lane.sessionId !== undefined && onOpenSession !== undefined ? (
        <Button
          className="pa-chip"
          variant="ghost"
          size="sm"
          style={style}
          onClick={() => onOpenSession(lane.sessionId as string)}
        >
          {content}
        </Button>
      ) : (
        <span className="pa-chip" style={style}>
          {content}
        </span>
      )}
    </span>
  )
}

function clock(at: number): string {
  const date = new Date(at)
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

