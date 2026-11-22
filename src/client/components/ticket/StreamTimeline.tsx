// src/client/components/ticket/StreamTimeline.tsx
//
// 事件流：规模化降级视图。只列交接行（含介入），保留 from → to 与摘要；
// 里程碑与 Live 留在泳道视图。点击行同样就地展开。

import {
  IconChevronRightOutlineRegular,
  Tooltip,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { ReactElement } from 'react'
import type { AgentLaneView, ChainRow } from '../../../shared/ticket-detail.ts'
import type { ConsoleActions } from '../../actions.ts'
import type { Translate } from '../../i18n.ts'
import {
  formatClockTime,
  formatFullTime,
  laneColor,
  laneName,
  rowIsHandoff,
  rowKindClass,
  rowTypeKey,
} from '../../lib/chain.ts'
import { RowExpand } from './RowExpand.tsx'

export interface StreamTimelineProps {
  t: Translate
  language: string
  rows: readonly ChainRow[]
  lanes: readonly AgentLaneView[]
  selectedRowId?: string
  actions: ConsoleActions
  onToggleRow: (rowId: string) => void
}

export function StreamTimeline({
  t,
  language,
  rows,
  lanes,
  selectedRowId,
  actions,
  onToggleRow,
}: StreamTimelineProps): ReactElement {
  const handoffs = rows.filter(rowIsHandoff)
  if (handoffs.length === 0) {
    return <div className="pa-timeline__empty">{t('ticketStreamEmpty')}</div>
  }

  return (
    <div className="pa-stream">
      {handoffs.map(row => {
        const selected = selectedRowId === row.id
        const panelId = `pa-stream-expand-${row.id.replace(/[^A-Za-z0-9_-]/g, '-')}`
        const from = nameOf(row.from, lanes, t)
        const to =
          row.kind === 'fan'
            ? t('ticketRowFanTargets', { count: row.to.length })
            : nameOf(row.to, lanes, t)
        const summary =
          row.kind === 'fan'
            ? row.to.map(target => target.summary).filter(text => text.length > 0).join(' · ')
            : row.summary
        const full = formatFullTime(language, row.at)
        const tip = [t(rowTypeKey(row)), `${from} → ${to}`, summary, full]
          .filter(part => part.length > 0)
          .join(' · ')

        return (
          <div key={row.id} className={`pa-stream__row-wrap ${rowKindClass(row)}`}>
            <Tooltip label={tip} side="top" delayMs={300} maxWidth={320}>
              <button
                type="button"
                className={`pa-stream__row${selected ? ' pa-stream__row--selected' : ''}`}
                aria-expanded={selected}
                aria-controls={selected ? panelId : undefined}
                onClick={() => onToggleRow(row.id)}
                onKeyDown={event => {
                  if (event.key === 'Escape' && selected) onToggleRow(row.id)
                }}
              >
                <Tooltip label={full} side="top" align="end">
                  <time
                    className="pa-stream__time"
                    dateTime={new Date(row.at).toISOString()}
                    aria-label={full}
                  >
                    {formatClockTime(row.at)}
                  </time>
                </Tooltip>
                <span className="pa-stream__kind" aria-label={t(rowTypeKey(row))}>
                  {t(rowTypeKey(row))}
                </span>
                <span className="pa-stream__flow">
                  <b style={{ color: laneColor(row.from, lanes) }}>{from}</b>
                  <span className="pa-stream__arrow" aria-hidden="true">
                    <IconChevronRightOutlineRegular size={12} />
                  </span>
                  <b
                    style={{
                      color:
                        row.kind === 'fan'
                          ? undefined
                          : laneColor(row.to, lanes),
                    }}
                  >
                    {to}
                  </b>
                </span>
                <span className="pa-stream__summary">{summary}</span>
              </button>
            </Tooltip>
            {selected ? (
              <div id={panelId}>
                <RowExpand
                  t={t}
                  language={language}
                  row={row}
                  lanes={lanes}
                  actions={actions}
                  variant="stream"
                />
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

function nameOf(id: string, lanes: readonly AgentLaneView[], t: Translate): string {
  const lane = lanes.find(item => item.id === id)
  return lane === undefined ? id : laneName(lane, t)
}
