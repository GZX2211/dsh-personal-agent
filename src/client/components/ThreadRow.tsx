// src/client/components/ThreadRow.tsx
//
// 来源内的一条线程：名称、投递/过滤计数、最近触发与开关。
// 线程关闭等于它不存在（不产生、不记录），因此开关就是唯一入口。

import { Switch } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ReactElement } from 'react'
import type { SourceThreadView } from '../../shared/sources.ts'
import type { Translate } from '../i18n.ts'
import { formatRelativeTime } from '../lib/format.ts'

export interface ThreadRowProps {
  t: Translate
  language: string
  now: number
  thread: SourceThreadView
  /** 该来源上有写操作进行中：禁止并发改线程开关。 */
  busy: boolean
  enabled: boolean
  onToggle: (enabled: boolean) => void
}

export function ThreadRow({
  t,
  language,
  now,
  thread,
  busy,
  enabled,
  onToggle,
}: ThreadRowProps): ReactElement {
  return (
    <div className="pa-thread">
      <div className="pa-thread__main">
        <span className="pa-thread__name">{thread.name}</span>
        <span className="pa-thread__counts">
          {`${t('sourceThreadDelivered', { count: thread.deliveredCount })} · ${t('sourceThreadFiltered', { count: thread.filteredCount })}`}
        </span>
      </div>
      <span className="pa-thread__time">
        {thread.lastEventAt === undefined
          ? t('sourcesNever')
          : formatRelativeTime(t, language, thread.lastEventAt, now)}
      </span>
      <Switch
        className="pa-thread__switch"
        checked={enabled}
        disabled={busy}
        label={thread.name}
        onChange={onToggle}
      />
    </div>
  )
}
