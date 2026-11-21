// src/client/views/Overview.tsx
//
// 概览页：状态脉搏 → 注意力条 → 进行中 → 今天/7 天 → 底栏。
// 只读 + 跳转；所有派生计算在 lib/overview.ts，组件只负责渲染与分发点击。

import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ReactElement } from 'react'
import type { SnapshotResponse } from '../../shared/api.ts'
import type { ConsoleActions } from '../actions.ts'
import { ActivityChart } from '../components/overview/ActivityChart.tsx'
import { AttentionBar } from '../components/overview/AttentionBar.tsx'
import { OverviewFooter } from '../components/overview/OverviewFooter.tsx'
import { OverviewSkeleton } from '../components/overview/OverviewSkeleton.tsx'
import { Pulse } from '../components/overview/Pulse.tsx'
import { TodayPanel } from '../components/overview/TodayPanel.tsx'
import { WorkerFleet } from '../components/overview/WorkerFleet.tsx'
import type { Translate } from '../i18n.ts'
import type { ConsoleTabId } from '../lib/navigation.ts'
import {
  attentionOf,
  fleetOf,
  footerOf,
  isFreshEmpty,
  pulseOf,
  todayOf,
  type AttentionTarget,
} from '../lib/overview.ts'

export interface OverviewProps {
  t: Translate
  language: string
  snapshot?: SnapshotResponse
  error?: string
  refresh: () => void
  actions: ConsoleActions
  onNavigate: (tab: ConsoleTabId) => void
  /** 渲染时刻；测试注入，缺省 Date.now()。 */
  now?: number
}

export function Overview({
  t,
  language,
  snapshot,
  error,
  refresh,
  actions,
  onNavigate,
  now = Date.now(),
}: OverviewProps): ReactElement {
  const banner = error === undefined ? null : <ConnectionBanner t={t} refresh={refresh} />

  if (snapshot === undefined) {
    return (
      <div className="pa-overview">
        {banner}
        <OverviewSkeleton t={t} />
      </div>
    )
  }

  const pulse = pulseOf(snapshot)
  const openRouter = (): void => {
    if (snapshot.routerSessionId !== undefined) actions.openSession(snapshot.routerSessionId)
  }

  if (isFreshEmpty(snapshot)) {
    return (
      <div className="pa-overview">
        {banner}
        <Pulse
          t={t}
          language={language}
          pulse={pulse}
          now={now}
          stale={error !== undefined}
          onOpenRouter={openRouter}
        />
        <div className="pa-overview__empty">
          <h2 className="pa-overview__empty-title">{t('overviewEmptyTitle')}</h2>
          <p className="pa-overview__empty-body">{t('overviewEmptyBody')}</p>
          <Button variant="outline" size="sm" onClick={() => onNavigate('sources')}>
            {t('overviewOpenSources')}
          </Button>
        </div>
      </div>
    )
  }

  const attention = attentionOf(snapshot, now)
  const fleet = fleetOf(snapshot, now)
  const today = todayOf(snapshot, now)
  const footer = footerOf(snapshot)

  const activate = (target: AttentionTarget): void => {
    if (target.kind === 'session') actions.openSession(target.sessionId)
    else onNavigate(target.tab)
  }

  return (
    <div className="pa-overview">
      {banner}
      <Pulse
        t={t}
        language={language}
        pulse={pulse}
        now={now}
        stale={error !== undefined}
        onOpenRouter={openRouter}
      />
      <AttentionBar t={t} language={language} items={attention} now={now} onActivate={activate} />
      <WorkerFleet
        t={t}
        language={language}
        fleet={fleet}
        now={now}
        onOpenSession={sessionId => actions.openSession(sessionId)}
        onOpenTickets={() => onNavigate('tickets')}
      />
      <TodayPanel t={t} language={language} today={today} />
      <ActivityChart t={t} language={language} activity={snapshot.activity} />
      <OverviewFooter t={t} language={language} footer={footer} />
    </div>
  )
}

function ConnectionBanner({ t, refresh }: { t: Translate; refresh: () => void }): ReactElement {
  return (
    <div className="pa-banner" role="status">
      <span>{t('approvalConnectionLost')}</span>
      <button type="button" className="pa-banner__retry" onClick={() => refresh()}>
        {t('approvalRefresh')}
      </button>
    </div>
  )
}
