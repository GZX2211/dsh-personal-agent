// src/client/components/overview/Pulse.tsx
//
// 状态脉搏：一行说明 PA 活着吗。有 Router 会话时整行可点，直接打开它。

import { StateDot, type StateDotState } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ReactElement } from 'react'
import type { Translate } from '../../i18n.ts'
import { formatRelativeTime } from '../../lib/format.ts'
import type { PulseView } from '../../lib/overview.ts'

export interface PulseProps {
  t: Translate
  language: string
  pulse: PulseView
  now: number
  /** 有快照但连接失败：右侧改为「数据可能已过期」。 */
  stale: boolean
  onOpenRouter: () => void
}

export function Pulse({ t, language, pulse, now, stale, onOpenRouter }: PulseProps): ReactElement {
  const content = (
    <>
      <span className="pa-overview__pulse-copy">
        <StateDot state={dotStateOf(pulse.state)} className="pa-overview__pulse-dot" />
        <span className="pa-overview__pulse-label">{t(labelKeyOf(pulse.state))}</span>
      </span>
      <span className="pa-overview__pulse-ago">
        {stale
          ? t('overviewStale')
          : pulse.lastActivityAt === undefined
            ? t('overviewPulseNoActivity')
            : t('overviewPulseLastActivity', {
                time: formatRelativeTime(t, language, pulse.lastActivityAt, now),
              })}
      </span>
    </>
  )

  if (!pulse.clickable) {
    return <div className="pa-overview__pulse">{content}</div>
  }
  return (
    <button
      type="button"
      className="pa-overview__pulse"
      title={t('overviewPulseOpenRouter')}
      aria-label={t('overviewPulseOpenRouter')}
      onClick={onOpenRouter}
    >
      {content}
    </button>
  )
}

function labelKeyOf(
  state: PulseView['state'],
): 'overviewPulseRunning' | 'overviewPulseSensing' | 'overviewPulseIdle' | 'overviewPulseNoRouter' {
  switch (state) {
    case 'running':
      return 'overviewPulseRunning'
    case 'sensing':
      return 'overviewPulseSensing'
    case 'idle':
      return 'overviewPulseIdle'
    case 'no-router':
      return 'overviewPulseNoRouter'
  }
}

function dotStateOf(state: PulseView['state']): StateDotState {
  switch (state) {
    case 'running':
      return 'ongoing'
    case 'sensing':
      return 'done'
    case 'idle':
      return 'idle'
    case 'no-router':
      return 'warning'
  }
}
