// src/client/views/Tickets.tsx
//
// 工单页：胶囊（待处理 / 进行中 / 已结束 / 全部）+ 搜索；卡片与审批页同款，
// 只是没有展开态与动作按钮。

import { useState, type ReactElement } from 'react'
import type { SnapshotResponse } from '../../shared/api.ts'
import type { TicketView } from '../../shared/tickets.ts'
import { FilterBar } from '../components/FilterBar.tsx'
import { TicketCard } from '../components/TicketCard.tsx'
import type { Translate } from '../i18n.ts'
import { filterTickets } from '../lib/filter.ts'
import { matchesTicketCapsule, type TicketCapsule } from '../lib/tickets.ts'

const CAPSULES: readonly TicketCapsule[] = ['queued', 'running', 'ended', 'all']

export interface TicketsProps {
  t: Translate
  language: string
  snapshot?: SnapshotResponse
  /** 从审批卡跳过来的工单：落到「全部」并高亮它。 */
  focusTicketId?: string
}

export function Tickets({ t, language, snapshot, focusTicketId }: TicketsProps): ReactElement {
  const [capsule, setCapsule] = useState<TicketCapsule>(focusTicketId === undefined ? 'running' : 'all')
  const [query, setQuery] = useState('')

  const tickets = snapshot?.tickets ?? []
  const visible = filterTickets(tickets, capsule, query, { t, language })
  const capsuleHasItems = tickets.some(ticket => matchesTicketCapsule(ticket, capsule))

  return (
    <>
      <FilterBar
        options={CAPSULES.map(id => ({ id, label: t(capsuleLabelKey(id)) }))}
        active={capsule}
        onSelect={id => setCapsule(id as TicketCapsule)}
        query={query}
        onQueryChange={setQuery}
        searchPlaceholder={t('searchPlaceholder')}
        help={{
          label: t('helpOpen'),
          title: t('helpTitle'),
          paragraphs: [t('helpBodyTickets'), t('helpBodySearch')],
          closeLabel: t('helpClose'),
        }}
      />

      <div className="pa-list">
        {visible.length === 0 ? (
          <span className="pa-console__empty">{t(emptyKey(capsule, query, capsuleHasItems))}</span>
        ) : (
          visible.map(ticket => (
            <TicketCard
              key={ticket.id}
              t={t}
              language={language}
              ticket={ticket}
              focused={ticket.id === focusTicketId}
            />
          ))
        )}
      </div>
    </>
  )
}

function capsuleLabelKey(capsule: TicketCapsule): 'ticketsFilterQueued' | 'ticketsFilterRunning' | 'ticketsFilterEnded' | 'ticketsFilterAll' {
  switch (capsule) {
    case 'queued':
      return 'ticketsFilterQueued'
    case 'running':
      return 'ticketsFilterRunning'
    case 'ended':
      return 'ticketsFilterEnded'
    case 'all':
      return 'ticketsFilterAll'
  }
}

function emptyKey(
  capsule: TicketCapsule,
  query: string,
  capsuleHasItems: boolean,
): 'ticketsEmptyQueued' | 'ticketsEmptyRunning' | 'ticketsEmptyEnded' | 'ticketsEmptyAll' | 'ticketsNoMatch' {
  if (capsuleHasItems && query.trim().length > 0) return 'ticketsNoMatch'
  switch (capsule) {
    case 'queued':
      return 'ticketsEmptyQueued'
    case 'running':
      return 'ticketsEmptyRunning'
    case 'ended':
      return 'ticketsEmptyEnded'
    case 'all':
      return 'ticketsEmptyAll'
  }
}
