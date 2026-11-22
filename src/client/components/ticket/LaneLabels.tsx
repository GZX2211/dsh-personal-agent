// src/client/components/ticket/LaneLabels.tsx
//
// 泳道标签行：sticky 在时间线顶部。点标签聚焦一个 Agent；`+N` 展开被折叠的
// 安静子代理。缩窄模式下只取前两个字母/汉字，完整信息在悬停 tip 里。

import type { ReactElement } from 'react'
import type { AgentLaneView } from '../../../shared/ticket-detail.ts'
import type { Translate } from '../../i18n.ts'
import {
  compactName,
  LANE_PAD,
  laneColor,
  laneName,
  laneRoleLabel,
  laneTooltip,
  type LaneLayout,
} from '../../lib/chain.ts'

export interface LaneLabelsProps {
  t: Translate
  layout: LaneLayout
  focusedLaneId?: string
  expanded: boolean
  onFocus: (laneId: string) => void
  onToggleMore: () => void
}

export function LaneLabels({
  t,
  layout,
  focusedLaneId,
  expanded,
  onFocus,
  onToggleMore,
}: LaneLabelsProps): ReactElement {
  const columns = layout.lanes.length + (layout.hiddenCount > 0 || expanded ? 1 : 0)
  return (
    <div
      className={`pa-lanes${layout.compact ? ' pa-lanes--compact' : ''}`}
      style={{
        width: `${columns * layout.laneWidth}px`,
        marginLeft: `${LANE_PAD - layout.laneWidth / 2}px`,
      }}
      role="group"
      aria-label={t('ticketTimelineTitle')}
    >
      {layout.lanes.map(lane => (
        <LaneLabel
          key={lane.id}
          t={t}
          lane={lane}
          width={layout.laneWidth}
          compact={layout.compact}
          focused={focusedLaneId === lane.id}
          dimmed={focusedLaneId !== undefined && focusedLaneId !== lane.id}
          onFocus={onFocus}
        />
      ))}
      {layout.hiddenCount > 0 || expanded ? (
        <button
          type="button"
          className="pa-lane pa-lane--more"
          style={{ width: `${layout.laneWidth}px`, flexBasis: `${layout.laneWidth}px` }}
          title={expanded ? t('ticketLanesLessTitle') : t('ticketLanesMoreTitle', { count: layout.hiddenCount })}
          aria-label={expanded ? t('ticketLanesLess') : t('ticketLanesMoreTitle', { count: layout.hiddenCount })}
          aria-expanded={expanded}
          onClick={onToggleMore}
        >
          <span className="pa-lane__name">{expanded ? '−' : t('ticketLanesMore', { count: layout.hiddenCount })}</span>
        </button>
      ) : null}
    </div>
  )
}

function LaneLabel({
  t,
  lane,
  width,
  compact,
  focused,
  dimmed,
  onFocus,
}: {
  t: Translate
  lane: AgentLaneView
  width: number
  compact: boolean
  focused: boolean
  dimmed: boolean
  onFocus: (laneId: string) => void
}): ReactElement {
  const name = laneName(lane, t)
  return (
    <button
      type="button"
      className={`pa-lane${focused ? ' pa-lane--focused' : ''}${dimmed ? ' pa-lane--dim' : ''}`}
      style={{ width: `${width}px`, flexBasis: `${width}px` }}
      title={laneTooltip(lane, t)}
      aria-label={laneTooltip(lane, t)}
      aria-pressed={focused}
      onClick={() => onFocus(lane.id)}
    >
      <span className="pa-lane__name">
        <span className="pa-lane__dot" style={{ background: laneColor(lane.id, [lane]) }} aria-hidden="true" />
        {compact ? compactName(name) : name}
      </span>
      {compact ? null : <span className="pa-lane__role">{laneRoleLabel(lane, t)}</span>}
    </button>
  )
}

