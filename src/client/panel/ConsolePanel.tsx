// src/client/panel/ConsolePanel.tsx
//
// 总控台正文：顶部一条标签条，下面是当前页。面板本身不再有标题与说明——
// 标签条上的名字就是它（「总控台」），再放一层标题只是重复。
//
// 快照在这里拉一次，各列表页共用：各页各轮询一次会让同一份数据在同一屏里
// 出现两种时刻的状态。标签上的待审批数也来自这一次快照。
//
// 事件页点结局要跳到工单页：跳转通过「切标签 + 给工单页一个初始搜索词」完成，
// 工单页用 key 重挂载，因此不需要受控搜索状态。

import { useState, type ReactElement } from 'react'
import { shortTicketId } from '../../shared/tickets.ts'
import type { ConsoleActions } from '../actions.ts'
import { NO_ACTIONS } from '../actions.ts'
import { ConsoleTabStrip, type ConsoleTab } from '../components/ConsoleTabStrip.tsx'
import { useSnapshot } from '../hooks/useSnapshot.ts'
import { CONSOLE_CSS } from '../style.ts'
import { Approvals } from '../views/Approvals.tsx'
import { Events } from '../views/Events.tsx'
import { Overview } from '../views/Overview.tsx'
import { Settings } from '../views/Settings.tsx'
import { Sources } from '../views/Sources.tsx'
import { Tickets } from '../views/Tickets.tsx'
import { TicketDetail } from '../views/TicketDetail.tsx'
import type { Translate } from '../i18n.ts'
import type { ConsoleTabId } from '../lib/navigation.ts'

/** 打开时落在概览：它汇总待审批与异常，审批页仍保留徽标与直达入口。 */
const INITIAL_TAB: ConsoleTabId = 'overview'

export interface ConsolePanelProps {
  t: Translate
  /** 当前界面语言，用于日期与时间的本地化。 */
  language?: string
  /** 右侧栏所在会话；文件预览用它授权读取。 */
  sessionId?: string
  /** 由 entry 注入的动作面；缺省时卡片按钮退化为无操作。 */
  actions?: ConsoleActions
}

export function ConsolePanel({
  t,
  language = 'zh',
  sessionId,
  actions = NO_ACTIONS,
}: ConsolePanelProps): ReactElement {
  const [active, setActive] = useState<ConsoleTabId>(INITIAL_TAB)
  const [ticketFocus, setTicketFocus] = useState<string>()
  /** 正在看详情的工单；列表仍挂载在下面，切回来时胶囊与搜索都还在。 */
  const [detailTicketId, setDetailTicketId] = useState<string>()
  const { snapshot, error, refresh } = useSnapshot()

  const tabs: ConsoleTab[] = [
    { id: 'overview', label: t('tabOverview') },
    { id: 'approvals', label: t('tabApprovals'), badge: snapshot?.stats.approvals.pending },
    { id: 'tickets', label: t('tabTickets') },
    { id: 'events', label: t('tabEvents') },
    { id: 'sources', label: t('tabSources') },
    { id: 'settings', label: t('tabSettings') },
  ]

  /** 事件页的结局跳到工单页：切标签并让工单页按短码定位。 */
  const openTicket = (ticketId: string): void => {
    setTicketFocus(shortTicketId(ticketId))
    setActive('tickets')
  }

  /** 切走标签就退出详情：回到工单页时先看到列表，而不是一个不请自来的详情。 */
  const selectTab = (id: ConsoleTabId): void => {
    setDetailTicketId(undefined)
    setActive(id)
  }

  return (
    <div className="pa-console">
      <style>{CONSOLE_CSS}</style>
      <ConsoleTabStrip tabs={tabs} active={active} onSelect={id => selectTab(id as ConsoleTabId)} />
      <div className="pa-console__body" role="tabpanel">
        {active === 'overview' ? (
          <Overview
            t={t}
            language={language}
            snapshot={snapshot}
            error={error}
            refresh={refresh}
            actions={actions}
            onNavigate={tab => setActive(tab)}
          />
        ) : null}
        {active === 'approvals' ? (
          <Approvals
            t={t}
            language={language}
            sessionId={sessionId}
            snapshot={snapshot}
            error={error}
            refresh={refresh}
            actions={actions}
          />
        ) : null}
        {active === 'tickets' ? (
          <>
            <div className={detailTicketId === undefined ? 'pa-ticketpage' : 'pa-ticketpage pa-ticketpage--hidden'}>
              <Tickets
                key={ticketFocus ?? 'all'}
                t={t}
                language={language}
                snapshot={snapshot}
                initialQuery={ticketFocus}
                onOpenTicket={setDetailTicketId}
              />
            </div>
            {detailTicketId === undefined ? null : (
              <TicketDetail
                t={t}
                ticketId={detailTicketId}
                onBack={() => setDetailTicketId(undefined)}
                actions={actions}
              />
            )}
          </>
        ) : null}
        {active === 'events' ? (
          <Events
            t={t}
            language={language}
            snapshot={snapshot}
            error={error}
            refresh={refresh}
            onOpenTicket={openTicket}
          />
        ) : null}
        {active === 'sources' ? (
          <Sources
            t={t}
            language={language}
            snapshot={snapshot}
            error={error}
            refresh={refresh}
            actions={actions}
          />
        ) : null}
        {active === 'settings' ? <Settings t={t} language={language} /> : null}
      </div>
    </div>
  )
}
