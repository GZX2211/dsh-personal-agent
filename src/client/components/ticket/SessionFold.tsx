// src/client/components/ticket/SessionFold.tsx
//
// 会话与目录：负责人、活跃子代理、工作目录与会话 id。默认折叠，只在需要核对
// 「这单到底跑在哪个会话/目录」时展开。

import type { ReactElement } from 'react'
import type { TicketDetailResponse } from '../../../shared/ticket-detail.ts'
import type { Translate } from '../../i18n.ts'
import { ensureCoreLanes, laneName } from '../../lib/chain.ts'
import { FoldSection } from './FoldSection.tsx'

export interface SessionFoldProps {
  t: Translate
  detail: TicketDetailResponse
  open: boolean
  onToggle: () => void
}

export function SessionFold({ t, detail, open, onToggle }: SessionFoldProps): ReactElement {
  const { ticket, metrics } = detail
  const lanes = ensureCoreLanes(detail.lanes, ticket.workerSessionId)
  const owner = lanes.find(lane => lane.role === 'lead')
  const subagents = lanes.filter(lane => lane.role === 'subagent')
  const directory =
    ticket.directory ??
    (ticket.workerSessionId === undefined
      ? t('ticketSessionDirectoryUnknown')
      : t('ticketSessionDirectoryDefault'))
  const meta =
    ticket.workerSessionId === undefined
      ? t('ticketSessionNoWorker')
      : `${t('ticketSessionCount', { count: metrics.agents })} · ${directory}`

  return (
    <FoldSection id="pa-session-fold" title={t('ticketSessionTitle')} meta={meta} open={open} onToggle={onToggle}>
      <div className="pa-fold__kv">
        <span className="pa-fold__key">{t('ticketSessionOwner')}</span>
        <span className="pa-fold__value">
          {owner === undefined
            ? t('ticketSessionNoWorker')
            : `${laneName(owner, t)}${owner.sessionId === undefined ? '' : ` · ${owner.sessionId}`}`}
        </span>
      </div>
      <div className="pa-fold__kv">
        <span className="pa-fold__key">{t('ticketSessionSubagents')}</span>
        <span className="pa-fold__value">
          {subagents.length === 0 ? t('ticketSessionNone') : subagents.map(lane => laneName(lane, t)).join(' · ')}
        </span>
      </div>
      <div className="pa-fold__kv">
        <span className="pa-fold__key">{t('ticketSessionDirectory')}</span>
        <span className="pa-fold__value">{directory}</span>
      </div>
      <div className="pa-fold__kv">
        <span className="pa-fold__key">{t('ticketSessionId')}</span>
        <span className="pa-fold__value">{ticket.workerSessionId ?? t('ticketSessionNoWorker')}</span>
      </div>
    </FoldSection>
  )
}
