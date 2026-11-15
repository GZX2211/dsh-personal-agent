// src/client/panel/ConsolePanel.tsx
//
// 总控台正文：顶部一条标签条，下面是当前页。面板本身不再有标题与说明——
// 标签条上的名字就是它（「总控台」），再放一层标题只是重复。

import { useState, type ReactElement } from 'react'
import { ConsoleTabStrip, type ConsoleTab } from '../components/ConsoleTabStrip.tsx'
import { CONSOLE_CSS } from '../style.ts'
import { Placeholder } from '../views/Placeholder.tsx'
import type { Translate } from '../i18n.ts'

export type ConsoleTabId = 'overview' | 'approvals' | 'tickets' | 'events' | 'sources' | 'settings'

/** 已经能承接内容的标签页；其余四个在 MVP 之后实现。 */
const IMPLEMENTED: readonly ConsoleTabId[] = ['approvals', 'tickets']

/**
 * 打开时落在「审批」：MVP 里它是唯一有动作可做的页面，概览等内容要等 MVP 之后。
 */
const INITIAL_TAB: ConsoleTabId = 'approvals'

export interface ConsolePanelProps {
  t: Translate
}

export function ConsolePanel({ t }: ConsolePanelProps): ReactElement {
  const [active, setActive] = useState<ConsoleTabId>(INITIAL_TAB)

  const tabs: ConsoleTab[] = [
    { id: 'overview', label: t('tabOverview') },
    { id: 'approvals', label: t('tabApprovals') },
    { id: 'tickets', label: t('tabTickets') },
    { id: 'events', label: t('tabEvents') },
    { id: 'sources', label: t('tabSources') },
    { id: 'settings', label: t('tabSettings') },
  ]

  return (
    <div className="pa-console">
      <style>{CONSOLE_CSS}</style>
      <ConsoleTabStrip tabs={tabs} active={active} onSelect={id => setActive(id as ConsoleTabId)} />
      <div className="pa-console__body" role="tabpanel">
        {active === 'approvals' ? <span className="pa-console__empty">{t('approvalsEmpty')}</span> : null}
        {active === 'tickets' ? <span className="pa-console__empty">{t('ticketsEmpty')}</span> : null}
        {IMPLEMENTED.includes(active) ? null : (
          <Placeholder
            title={tabs.find(tab => tab.id === active)?.label ?? t('notAvailable')}
            hint={t('notAvailableHint')}
          />
        )}
      </div>
    </div>
  )
}
