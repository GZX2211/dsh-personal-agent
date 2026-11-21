// src/client/components/overview/WorkerFleet.tsx
//
// 进行中的 Worker 舰队：头部给占用/容量与排队，行最多 5 条，其余折叠。
// 槽位段只表达容量关系；超过 8 个槽位退化为一条比例条。

import type { ReactElement } from 'react'
import type { Translate } from '../../i18n.ts'
import type { FleetView } from '../../lib/overview.ts'
import { WorkerRow } from './WorkerRow.tsx'

/** 超过这个数量，槽位段换成比例条。 */
const SEAT_LIMIT = 8
const VISIBLE_ROWS = 5

export interface WorkerFleetProps {
  t: Translate
  language: string
  fleet: FleetView
  now: number
  onOpenSession: (sessionId: string) => void
  onOpenTickets: () => void
}

export function WorkerFleet({
  t,
  language,
  fleet,
  now,
  onOpenSession,
  onOpenTickets,
}: WorkerFleetProps): ReactElement {
  const visible = fleet.rows.slice(0, VISIBLE_ROWS)
  const hidden = fleet.rows.length - visible.length

  return (
    <section className="pa-overview__fleet">
      <div className="pa-overview__fleet-head">
        <span className="pa-overview__fleet-title">{t('overviewFleetTitle')}</span>
        <span className="pa-overview__fleet-count">
          {fleet.occupied} / {fleet.maxWorkers}
        </span>
        <Seats fleet={fleet} />
        {fleet.queued > 0 ? (
          <span className="pa-overview__queue">{t('overviewFleetQueue', { count: fleet.queued })}</span>
        ) : null}
      </div>

      {visible.length === 0 ? (
        <p className="pa-overview__empty-line">
          {t('overviewFleetEmpty')} · {t('overviewFleetEmptyHint')}
        </p>
      ) : (
        <div className="pa-overview__workers">
          {visible.map(row => (
            <WorkerRow
              key={row.ticket.id}
              t={t}
              language={language}
              row={row}
              now={now}
              onOpen={() => onOpenSession(row.workerSessionId)}
            />
          ))}
        </div>
      )}

      {hidden > 0 ? (
        <button type="button" className="pa-overview__worker-more" onClick={onOpenTickets}>
          {t('overviewFleetMore', { count: hidden })}
        </button>
      ) : null}
    </section>
  )
}

function Seats({ fleet }: { fleet: FleetView }): ReactElement {
  if (fleet.maxWorkers > SEAT_LIMIT) {
    const ratio = Math.min(1, fleet.occupied / Math.max(1, fleet.maxWorkers))
    return (
      <span
        className="pa-overview__capacity"
        title={`${fleet.occupied} / ${fleet.maxWorkers}`}
        aria-label={`${fleet.occupied} / ${fleet.maxWorkers}`}
      >
        <span className="pa-overview__capacity-fill" style={{ width: `${ratio * 100}%` }} />
      </span>
    )
  }
  return (
    <span className="pa-overview__seats" aria-hidden="true">
      {Array.from({ length: fleet.maxWorkers }, (_, index) => (
        <span
          key={index}
          className="pa-overview__seat"
          data-state={index < fleet.running ? 'running' : index < fleet.occupied ? 'blocked' : 'empty'}
        />
      ))}
    </span>
  )
}
