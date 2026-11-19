// src/client/components/TimerCard.tsx
//
// 定时来源的只读卡片：官方调度器拥有这些任务，这里只展示节奏、下次触发与最近
// 投递，并提供一个跳到自动化任务页的入口。

import { Button, Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ReactElement } from 'react'
import type { TimerSourceView } from '../../shared/sources.ts'
import type { Translate } from '../i18n.ts'
import { formatRelativeTime } from '../lib/format.ts'
import { timerTimingText } from '../lib/sources.ts'

export interface TimerCardProps {
  t: Translate
  language: string
  now: number
  timer: TimerSourceView
  onOpen: () => void
}

export function TimerCard({ t, language, now, timer, onOpen }: TimerCardProps): ReactElement {
  return (
    <article className="pa-row" role="listitem" data-row-key={timer.scheduleId}>
      <div className="pa-row__head">
        <div className="pa-row__body">
          <div className="pa-row__titleline">
            <h3 className="pa-row__title">{timer.title}</h3>
            <div className="pa-row__aside">
              <Tag tone={timer.active ? 'success' : 'neutral'}>
                {t(timer.active ? 'timerActive' : 'timerPaused')}
              </Tag>
            </div>
          </div>

          <p className="pa-row__summary">{timerTimingText(t, language, timer.timing)}</p>

          <div className="pa-row__footer">
            <span className="pa-source__threads-summary">
              {t('timerDelivered', { count: timer.deliveredCount })}
            </span>
            <Button variant="ghost" size="sm" className="pa-timer__open" onClick={onOpen}>
              {t('timerOpen')}
            </Button>
            <span className="pa-row__time">
              {timer.nextAt === undefined
                ? t('sourcesNever')
                : `${t('timerNext')} · ${formatRelativeTime(t, language, timer.nextAt, now)}`}
            </span>
          </div>
        </div>
      </div>
    </article>
  )
}
