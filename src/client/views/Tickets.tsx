// src/client/views/Tickets.tsx
//
// 工单页：胶囊（待处理 / 进行中 / 已结束 / 全部）+ 搜索；卡片与审批页同款，
// 只是没有展开态与动作按钮。

import { AnimatedRows } from '@deepseek-ai/dsh-client-ui-primitives'
import { useState, type ReactElement } from 'react'
import type { SnapshotResponse } from '../../shared/api.ts'
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
  /** 初始搜索词：事件页跳工单时用短码定位；变化由父级以 key 重挂载生效。 */
  initialQuery?: string
}

export function Tickets({ t, language, snapshot, initialQuery }: TicketsProps): ReactElement {
  const [capsule, setCapsule] = useState<TicketCapsule>('running')
  const [query, setQuery] = useState(initialQuery ?? '')

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

      <AnimatedRows
        className="pa-list"
        role="list"
        label={t('ticketListLabel')}
        rowKeys={visible.map(ticket => ticket.id)}
        ready={visible.length > 0}
        resetKey={`${capsule}|${query}`}
      >
        {visible.length === 0 ? (
          <span className="pa-console__empty">{t(emptyKey(capsule, query, capsuleHasItems))}</span>
        ) : (
          visible.map(ticket => <TicketCard key={ticket.id} t={t} language={language} ticket={ticket} />)
        )}
      </AnimatedRows>
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
