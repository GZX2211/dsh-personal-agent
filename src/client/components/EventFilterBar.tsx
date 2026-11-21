// src/client/components/EventFilterBar.tsx
//
// 事件页的工具栏：左侧两个下拉（事件类型 / 处理方式），右侧搜索与帮助。
// 下拉只负责选择，过滤由页面用 lib/signals 计算。

import { IconSearchOutlineRegular, Input } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ReactElement } from 'react'
import type { Translate } from '../i18n.ts'
import {
  kindFilterLabelKey,
  SIGNAL_VERDICT_FILTERS,
  verdictFilterLabelKey,
  type SignalKindFilter,
  type SignalVerdictFilter,
} from '../lib/signals.ts'
import { FilterMenu, type FilterMenuOption } from './FilterMenu.tsx'
import { HelpDialog } from './HelpDialog.tsx'

const KIND_FILTERS: readonly SignalKindFilter[] = ['all', 'user', 'timer', 'perception']

export interface EventFilterBarProps {
  t: Translate
  kind: SignalKindFilter
  verdict: SignalVerdictFilter
  onKindChange: (kind: SignalKindFilter) => void
  onVerdictChange: (verdict: SignalVerdictFilter) => void
  query: string
  onQueryChange: (query: string) => void
  help: {
    label: string
    title: string
    paragraphs: readonly string[]
    closeLabel: string
  }
}

export function EventFilterBar({
  t,
  kind,
  verdict,
  onKindChange,
  onVerdictChange,
  query,
  onQueryChange,
  help,
}: EventFilterBarProps): ReactElement {
  const kindOptions: FilterMenuOption[] = KIND_FILTERS.map(id => ({
    id,
    label: t(kindFilterLabelKey(id)),
  }))
  const verdictOptions: FilterMenuOption[] = SIGNAL_VERDICT_FILTERS.map(id => ({
    id,
    label: t(verdictFilterLabelKey(id)),
  }))

  return (
    <div className="pa-toolbar">
      <div className="pa-toolbar__filters" role="group">
        <FilterMenu
          label={t('eventsKindFilterLabel')}
          valueLabel={t(kindFilterLabelKey(kind))}
          options={kindOptions}
          selectedId={kind}
          onSelect={id => onKindChange(id as SignalKindFilter)}
        />
        <FilterMenu
          label={t('eventsVerdictFilterLabel')}
          valueLabel={t(verdictFilterLabelKey(verdict))}
          options={verdictOptions}
          selectedId={verdict}
          onSelect={id => onVerdictChange(id as SignalVerdictFilter)}
        />
      </div>
      <div className="pa-toolbar__tools">
        <Input
          className="pa-toolbar__search"
          icon={<IconSearchOutlineRegular />}
          type="text"
          value={query}
          placeholder={t('searchPlaceholder')}
          aria-label={t('searchPlaceholder')}
          onChange={event => onQueryChange(event.target.value)}
        />
        <HelpDialog
          label={help.label}
          title={help.title}
          paragraphs={help.paragraphs}
          closeLabel={help.closeLabel}
        />
      </div>
    </div>
  )
}
