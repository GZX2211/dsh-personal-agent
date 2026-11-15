// src/client/panel/ConsolePanel.tsx
//
// 总控台正文：顶部一条标签条，下面是当前页。面板本身不再有标题与说明——
// 标签条上的名字就是它（「总控台」），再放一层标题只是重复。
//
// 快照在这里拉一次，两个列表页共用：两页各轮询一次会让同一份数据在同一屏里
// 出现两种时刻的状态。标签上的待审批数也来自这一次快照。

import { useMemo, useState, type ReactElement } from 'react'
import type { ConsoleActions } from '../actions.ts'
import { NO_ACTIONS } from '../actions.ts'
import { ConsoleTabStrip, type ConsoleTab } from '../components/ConsoleTabStrip.tsx'
import { useSnapshot } from '../hooks/useSnapshot.ts'
import { CONSOLE_CSS } from '../style.ts'
import { Approvals } from '../views/Approvals.tsx'
import { Placeholder } from '../views/Placeholder.tsx'
import { Tickets } from '../views/Tickets.tsx'
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
  /** 当前界面语言，用于日期与相对时间的本地化。 */
  language?: string
  /** 由 entry 注入的动作面；缺省时卡片按钮退化为无操作。 */
  actions?: ConsoleActions
}

export function ConsolePanel({ t, language = 'zh', actions = NO_ACTIONS }: ConsolePanelProps): ReactElement {
  const [active, setActive] = useState<ConsoleTabId>(INITIAL_TAB)
  /** 从审批卡点过来的工单：切页后要能一眼看到它。 */
  const [focusedTicket, setFocusedTicket] = useState<string>()
  const { snapshot, error, refresh } = useSnapshot()

  // 「关联工单」要跳工单页：那是这一层自己的状态，所以在这里覆盖注入的实现。
  const merged = useMemo<ConsoleActions>(
    () => ({
      ...actions,
      showTickets: ticketId => {
        setFocusedTicket(ticketId)
        setActive('tickets')
      },
    }),
    [actions],
  )

  const tabs: ConsoleTab[] = [
    { id: 'overview', label: t('tabOverview') },
    { id: 'approvals', label: t('tabApprovals'), badge: snapshot?.stats.approvals.pending },
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
        {active === 'approvals' ? (
          <Approvals
            t={t}
            language={language}
            snapshot={snapshot}
            error={error}
            refresh={refresh}
            actions={merged}
          />
        ) : null}
        {active === 'tickets' ? (
          <Tickets t={t} language={language} snapshot={snapshot} focusTicketId={focusedTicket} />
        ) : null}
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
