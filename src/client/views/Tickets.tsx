// src/client/views/Tickets.tsx
//
// 工单页：四胶囊（待处理 / 进行中 / 已结束 / 全部）+ 搜索 + 简略卡片。
// 阻塞中是进行中的副标签，所以 `blocked` 落在「进行中」胶囊里（方案 §5.1、§10.4）。

import { useState, type ReactElement } from 'react'
import { FilterBar } from '../components/FilterBar.tsx'
import { TicketCard } from '../components/TicketCard.tsx'
import type { SnapshotHandle } from '../hooks/useSnapshot.ts'
import { filterTickets, type FilterContext, type TicketCapsule } from '../lib/filter.ts'
import type { Dict, Translate } from '../i18n.ts'

const CAPSULES: readonly { id: TicketCapsule; label: keyof Dict }[] = [
  { id: 'queued', label: 'ticketsFilterQueued' },
  { id: 'running', label: 'ticketsFilterRunning' },
  { id: 'ended', label: 'ticketsFilterEnded' },
  { id: 'all', label: 'ticketsFilterAll' },
]

export interface TicketsProps {
  t: Translate
  language: string
  data: SnapshotHandle
}

export function Tickets({ t, language, data }: TicketsProps): ReactElement {
  const [capsule, setCapsule] = useState<TicketCapsule>('queued')
  const [query, setQuery] = useState('')

  const now = Date.now()
  const ctx: FilterContext = { t, language, now }
  const visible = filterTickets(data.snapshot?.tickets ?? [], capsule, query, ctx)
  const emptyText = emptyMessage(capsule, query, t)

  return (
    <div className="pa-tickets">
      <FilterBar
        segments={CAPSULES.map(item => ({ id: item.id, label: t(item.label) }))}
        active={capsule}
        onSelect={id => setCapsule(id as TicketCapsule)}
        query={query}
        onQueryChange={setQuery}
        placeholder={t('ticketsSearchPlaceholder')}
      />

      {visible.length === 0 ? (
        <span className="pa-console__empty">{emptyText}</span>
      ) : (
        visible.map(ticket => <TicketCard key={ticket.id} t={t} ticket={ticket} now={now} language={language} />)
      )}
    </div>
  )
}

function emptyMessage(capsule: TicketCapsule, query: string, t: Translate): string {
  if (query.trim().length > 0) return t('ticketsNoMatch')
  switch (capsule) {
    case 'queued':
      return t('ticketsEmptyQueued')
    case 'running':
      return t('ticketsEmptyRunning')
    case 'ended':
      return t('ticketsEmptyEnded')
    case 'all':
      return t('ticketsEmptyAll')
  }
}
