// src/client/lib/chain.ts
//
// 工单详情页的纯展示逻辑：泳道布局与缩写、时间简写、类型映射、交接计数、
// 下游高亮与 Live 过滤。输入即全部事实，不读 DOM、不读环境；组件只负责画。

import type {
  AgentLaneView,
  ApprovalRow,
  ChainRow,
  DispatchRow,
  FanRow,
  HopRow,
  InterveneRow,
  LiveAgentView,
  LiveRow,
  MilestoneKind,
  SpawnRow,
  SupplementRow,
} from '../../shared/ticket-detail.ts'
import type { Dict, Translate } from '../i18n.ts'

/** 折叠列的身份：不是真实会话，只表示 N 条安静泳道。 */
export const MORE_LANE_ID = '__more__'

/** 泳道标签左右留白；rail 宽 = pad * 2 + (列数 - 1) * laneWidth。 */
export const LANE_PAD = 22

/** 右侧 meta 的最小宽度：类型徽标 + 简写时间。 */
export const META_MIN_WIDTH = 96

/** 缩窄模式列宽。 */
export const COMPACT_LANE_WIDTH = 32

/** 默认最多显示几个子代理列。 */
export const MAX_SUBAGENT_LANES = 4

/** 身份色：Router 紫、人灰、负责人蓝，子代理按列顺序取剩余色。 */
const LANE_COLORS = ['#8b7bff', '#c9c9d0', '#5b8cff', '#3fb9a1', '#e0a24a', '#a98bff', '#e06b9c', '#4fb8d9'] as const

export function laneColor(laneId: string, lanes: readonly AgentLaneView[]): string {
  const lane = lanes.find(item => item.id === laneId)
  return lane === undefined ? '#8a93a6' : (LANE_COLORS[lane.index % LANE_COLORS.length] ?? '#8a93a6')
}

export interface LaneSelection {
  lanes: AgentLaneView[]
  hiddenCount: number
}

export interface LaneLayout extends LaneSelection {
  laneWidth: number
  railWidth: number
  compact: boolean
  /** 缩窄后仍放不下：此时才允许横向滚动。 */
  overflow: boolean
}

export interface LaneLayoutInput {
  lanes: readonly AgentLaneView[]
  rows: readonly ChainRow[]
  liveAgents?: readonly LiveAgentView[]
  /** 时间线卡的内容宽度；0 表示尚未测量，按 540 处理。 */
  cardWidth: number
  expanded: boolean
}

export function compactName(name: string): string {
  return Array.from(name).slice(0, 2).join('')
}

/**
 * 全名模式列宽：44–60，随列数增长，并给长名字留出宽度。
 *
 * 名字宽度只是估算（9px 等宽字体），真正是否缩窄由容器宽度决定；这里只负责
 * 在 540px 窄栏里给三主轨一个紧凑的默认值。
 */
export function fullLaneWidth(lanes: readonly AgentLaneView[]): number {
  const countWidth = 44 + Math.min(16, Math.max(0, lanes.length - 3) * 6)
  const textWidth = Math.max(
    0,
    ...lanes.map(lane => Math.ceil(Array.from(laneWidthName(lane)).length * 4.2 + 18)),
  )
  return Math.max(44, Math.min(60, Math.max(countWidth, textWidth)))
}

/**
 * 可见泳道：三主轨常驻；子代理不超过 4 列，超过时优先留下运行中或链上出现过的。
 *
 * 展开 `+N` 后不再折叠，由容器决定是否横向滚动。
 */
export function selectVisibleLanes(
  lanes: readonly AgentLaneView[],
  rows: readonly ChainRow[],
  liveAgents: readonly LiveAgentView[],
  expanded: boolean,
): LaneSelection {
  const main = lanes.filter(lane => lane.role !== 'subagent')
  const subs = lanes.filter(lane => lane.role === 'subagent')
  if (expanded || subs.length <= MAX_SUBAGENT_LANES) {
    return { lanes: [...main, ...subs], hiddenCount: 0 }
  }

  const active = subs.filter(
    lane =>
      lane.status === 'running' ||
      rows.some(row => rowLanes(row).includes(lane.id)) ||
      liveAgents.some(agent => agent.lane === lane.id),
  )
  const keep = new Set(active.slice(0, MAX_SUBAGENT_LANES).map(lane => lane.id))
  for (const lane of subs) {
    if (keep.size >= MAX_SUBAGENT_LANES) break
    keep.add(lane.id)
  }
  const visible = subs.filter(lane => keep.has(lane.id))
  return { lanes: [...main, ...visible], hiddenCount: subs.length - visible.length }
}

export function computeLaneLayout(input: LaneLayoutInput): LaneLayout {
  const width = input.cardWidth > 0 ? input.cardWidth : 540
  const selection = selectVisibleLanes(input.lanes, input.rows, input.liveAgents ?? [], input.expanded)
  // 折叠态需要一个 +N 列；展开态需要一个收起列，否则标签行会多出一列没有 rail 宽度。
  const columns = selection.lanes.length + (selection.hiddenCount > 0 || input.expanded ? 1 : 0)
  const fullWidth = LANE_PAD * 2 + Math.max(0, columns - 1) * fullLaneWidth(selection.lanes)
  const available = Math.max(0, width - META_MIN_WIDTH)
  const compact = fullWidth > available
  const laneWidth = compact ? COMPACT_LANE_WIDTH : fullLaneWidth(selection.lanes)
  const railWidth = LANE_PAD * 2 + Math.max(0, columns - 1) * laneWidth
  return {
    ...selection,
    laneWidth,
    railWidth,
    compact,
    overflow: railWidth > available,
  }
}

/** 泳道在 rail 上的 x 坐标；折叠列排在最后。 */
export function laneX(layout: LaneLayout, laneId: string): number | undefined {
  const index = layout.lanes.findIndex(lane => lane.id === laneId)
  if (index >= 0) return LANE_PAD + index * layout.laneWidth
  if (laneId === MORE_LANE_ID && layout.hiddenCount > 0) {
    return LANE_PAD + layout.lanes.length * layout.laneWidth
  }
  return undefined
}

export function laneName(lane: AgentLaneView, t: Translate): string {
  switch (lane.role) {
    case 'router':
      return t('ticketLaneRouter')
    case 'human':
      return t('ticketLaneHuman')
    case 'lead':
      return lane.sessionId === undefined ? t('ticketLaneWorker') : (lane.name ?? t('ticketLaneWorker'))
    case 'subagent':
      return lane.name ?? lane.sessionId?.slice(0, 8) ?? lane.id
  }
}

export function laneRoleLabel(lane: AgentLaneView, t: Translate): string {
  switch (lane.role) {
    case 'router':
      return t('ticketLaneRoleRouter')
    case 'human':
      return t('ticketLaneRoleHuman')
    case 'lead':
      return lane.sessionId === undefined ? t('ticketLaneRoleQueued') : t('ticketLaneRoleLead')
    case 'subagent':
      return t('ticketLaneRoleSubagent')
  }
}

export function laneStatusKey(status: AgentLaneView['status']): keyof Dict {
  switch (status) {
    case 'running':
      return 'ticketLaneStatusRunning'
    case 'idle':
      return 'ticketLaneStatusIdle'
    case 'blocked':
      return 'ticketLaneStatusBlocked'
    case 'done':
      return 'ticketLaneStatusDone'
    case 'stopped':
      return 'ticketLaneStatusStopped'
    case 'unknown':
      return 'ticketLaneStatusUnknown'
  }
}

/** 泳道标签的悬停全文：全名、角色、状态与当前回合。 */
export function laneTooltip(lane: AgentLaneView, t: Translate): string {
  const parts = [laneName(lane, t), laneRoleLabel(lane, t), t(laneStatusKey(lane.status))]
  if (lane.currentTurn !== undefined) parts.push(t('ticketLaneTurn', { turn: lane.currentTurn }))
  return parts.join(' · ')
}

/**
 * 三主轨的客户端兜底：旧 Host 只回 human/lead 时，页面仍要能画出 Router → Worker。
 *
 * 这是版本错位时的降级，不改变新 Host 的泳道契约；已有三轨时原样返回，避免每次
 * 渲染都重建数组。
 */
export function ensureCoreLanes(
  lanes: readonly AgentLaneView[],
  workerSessionId?: string,
): AgentLaneView[] {
  const router = lanes.find(lane => lane.role === 'router')
  const human = lanes.find(lane => lane.role === 'human')
  const lead = lanes.find(lane => lane.role === 'lead')
  const hasCore = router !== undefined && human !== undefined && lead !== undefined
  const ordered = lanes.every((lane, index) => lane.index === index)
  if (hasCore && ordered) return [...lanes]

  const core: AgentLaneView[] = [
    router ?? { id: 'router', index: 0, role: 'router', status: 'idle' },
    human ?? { id: 'human', index: 1, role: 'human', status: 'idle' },
    lead ??
      (workerSessionId === undefined
        ? { id: 'worker', index: 2, role: 'lead', status: 'idle' }
        : {
            id: workerSessionId,
            index: 2,
            role: 'lead',
            status: 'idle',
            sessionId: workerSessionId,
            name: 'lead',
          }),
  ]
  const subs = lanes.filter(lane => lane.role === 'subagent')
  return [...core, ...subs].map((lane, index) => ({ ...lane, index }))
}

/** 窄列里的时间只保留时分；完整日期在悬停 tip 里，避免 34px 列塞进日期后压住徽标。 */
export function formatClockTime(at: number): string {
  return clockOf(new Date(at))
}

/** 完整本地时间：`2026-11-22 09:18:22`。 */
export function formatFullTime(_language: string, at: number): string {
  const date = new Date(at)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${clockOf(date, true)}`
}

export function rowTypeKey(row: ChainRow): keyof Dict {
  switch (row.kind) {
    case 'dispatch':
      return row.mode === 'append' ? 'ticketTypeAppend' : 'ticketTypeDispatch'
    case 'supplement':
      return 'ticketTypeSupplement'
    case 'spawn':
    case 'fan':
      return 'ticketTypeSpawn'
    case 'hop':
      switch (row.direction) {
        case 'down':
          return 'ticketTypeSpawn'
        case 'up':
          return 'ticketTypeUp'
        case 'lateral':
          return 'ticketTypeSync'
      }
    case 'approval':
      return row.phase === 'request' ? 'ticketTypeApproval' : 'ticketTypeDecision'
    case 'intervene':
      return 'ticketTypeIntervene'
    case 'milestone':
      return milestoneTypeKey(row.milestone)
    case 'live':
      return 'ticketLive'
  }
}

function milestoneTypeKey(milestone: MilestoneKind): keyof Dict {
  switch (milestone) {
    case 'queued':
    case 'queue-busy':
    case 'queue-capacity':
      return 'ticketTypeQueued'
    case 'interrupted':
      return 'ticketTypeInterrupted'
    case 'resumed':
      return 'ticketTypeResumed'
    case 'approval-discarded':
      return 'ticketTypeApprovalDiscarded'
    case 'closed':
      return 'ticketTypeClosed'
    case 'failed':
      return 'ticketTypeFailed'
  }
}

/** 类型只影响徽标与节点颜色；连线颜色跟发送方身份色。 */
export function rowKindClass(row: ChainRow): string {
  switch (row.kind) {
    case 'dispatch':
      return 'pa-kind-dispatch'
    case 'supplement':
      return 'pa-kind-supplement'
    case 'spawn':
    case 'fan':
      return 'pa-kind-spawn'
    case 'hop':
      return row.direction === 'up' ? 'pa-kind-up' : row.direction === 'lateral' ? 'pa-kind-sync' : 'pa-kind-spawn'
    case 'approval':
      return row.phase === 'request' ? 'pa-kind-approval' : 'pa-kind-decision'
    case 'intervene':
      return 'pa-kind-intervene'
    case 'milestone':
      return row.milestone === 'failed' ? 'pa-kind-fail' : 'pa-kind-state'
    case 'live':
      return 'pa-kind-state'
  }
}

export function rowHeight(row: ChainRow): number {
  switch (row.kind) {
    case 'fan':
      return 46
    case 'milestone':
      return 26
    case 'live':
      return 30
    default:
      return 32
  }
}

export type HandoffRow =
  | DispatchRow
  | SupplementRow
  | SpawnRow
  | HopRow
  | FanRow
  | ApprovalRow
  | InterveneRow

export function rowIsHandoff(row: ChainRow): row is HandoffRow {
  return row.kind !== 'milestone' && row.kind !== 'live'
}

/** 交接数：fan 是一次事件，不按目标数展开。 */
export function handoffCount(rows: readonly ChainRow[]): number {
  return rows.filter(rowIsHandoff).length
}

/** 这一行涉及哪些泳道：用于聚焦、可见性与 Live 过滤。 */
export function rowLanes(row: ChainRow): string[] {
  switch (row.kind) {
    case 'fan':
      return unique([row.from, ...row.to.map(target => target.sessionId)])
    case 'milestone':
      return row.lane === undefined ? [] : [row.lane]
    case 'live':
      return unique([
        ...(row.lane === undefined ? [] : [row.lane]),
        ...(row.liveAgents ?? []).map(agent => agent.lane),
      ])
    case 'dispatch':
    case 'supplement':
    case 'spawn':
    case 'hop':
    case 'approval':
    case 'intervene':
      return unique([row.from, row.to])
  }
}

/** 行是否画在泳道视图里：两端至少一端可见；fan 允许只画可见目标。 */
export function rowVisible(row: ChainRow, visibleLaneIds: ReadonlySet<string>): boolean {
  switch (row.kind) {
    case 'milestone':
      return row.lane === undefined || visibleLaneIds.has(row.lane)
    case 'live':
      if (row.liveAgents !== undefined && row.liveAgents.length > 0) {
        return row.liveAgents.some(agent => visibleLaneIds.has(agent.lane))
      }
      return row.lane === undefined || visibleLaneIds.has(row.lane)
    case 'fan':
      return visibleLaneIds.has(row.from) && row.to.some(target => visibleLaneIds.has(target.sessionId))
    case 'dispatch':
    case 'supplement':
    case 'spawn':
    case 'hop':
    case 'approval':
    case 'intervene':
      return visibleLaneIds.has(row.from) && visibleLaneIds.has(row.to)
  }
}

export function visibleFanTargets(row: FanRow, visibleLaneIds: ReadonlySet<string>): FanRow['to'] {
  return row.to.filter(target => visibleLaneIds.has(target.sessionId))
}

/**
 * 下游高亮：选中行的接收方紧接着的下一步动作。
 *
 * 只扫连续区间：遇到第一条来自其他发送方的交接就停；里程碑不打断扫描。
 * 这是「紧邻下一步」，不是完整因果推断。
 */
export function downstreamIdsOf(rows: readonly ChainRow[], selectedId: string): string[] {
  const index = rows.findIndex(row => row.id === selectedId)
  if (index < 0) return []
  const selected = rows[index]
  if (selected === undefined || selected.kind === 'milestone' || selected.kind === 'live') return []

  const recipients = new Set(
    selected.kind === 'fan' ? selected.to.map(target => target.sessionId) : [selected.to],
  )
  const ids: string[] = []
  for (const row of rows.slice(index + 1)) {
    if (row.kind === 'milestone' || row.kind === 'live') continue
    if (!recipients.has(row.from)) break
    ids.push(row.id)
  }
  return ids
}

export interface LiveItem {
  lane: string
  text: string
}

/** Live 文案：后端只给活动原文，句式在这里用词典拼。 */
export function liveItems(
  t: Translate,
  row: LiveRow,
  lanes: readonly AgentLaneView[],
  visibleLaneIds?: ReadonlySet<string>,
): LiveItem[] {
  if (row.live === 'waiting-approval') return []
  const byId = new Map(lanes.map(lane => [lane.id, lane]))
  const nameOf = (laneId: string): string => {
    const lane = byId.get(laneId)
    return lane === undefined ? laneId : laneName(lane, t)
  }
  const agents: LiveAgentView[] =
    row.liveAgents !== undefined && row.liveAgents.length > 0
      ? [...row.liveAgents]
      : row.lane === undefined
        ? []
        : [{ lane: row.lane, ...(row.turn === undefined ? {} : { turn: row.turn }) }]

  return agents
    .filter(agent => visibleLaneIds === undefined || visibleLaneIds.has(agent.lane))
    .map(agent => {
      const name = nameOf(agent.lane)
      if (agent.activity !== undefined && agent.activity.length > 0) {
        return { lane: agent.lane, text: t('ticketLiveActivity', { name, activity: agent.activity }) }
      }
      if (agent.turn !== undefined) {
        return { lane: agent.lane, text: t('ticketLiveTurn', { name, turn: agent.turn }) }
      }
      return { lane: agent.lane, text: t('ticketLiveWaiting', { name }) }
    })
}

/** 未决审批的摘要来自最近一条审批请求行。 */
export function waitingApprovalSummary(rows: readonly ChainRow[]): string | undefined {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const row = rows[index]
    if (row !== undefined && row.kind === 'approval' && row.phase === 'request') return row.summary
  }
  return undefined
}

export function waitingApprovalText(t: Translate, rows: readonly ChainRow[]): string {
  const summary = waitingApprovalSummary(rows)
  return summary === undefined ? t('ticketLiveApprovalUnknown') : t('ticketLiveApproval', { summary })
}

/** 来源行类型：感知 / 用户 / 定时；没有信号时用中性的「工单」。 */
export function originKindKey(kind: 'user-message' | 'timer' | 'perception' | undefined): keyof Dict {
  switch (kind) {
    case 'user-message':
      return 'ticketOriginUser'
    case 'timer':
      return 'ticketOriginTimer'
    case 'perception':
      return 'ticketOriginPerception'
    default:
      return 'ticketOriginTicket'
  }
}

function laneWidthName(lane: AgentLaneView): string {
  switch (lane.role) {
    case 'router':
      return 'Router'
    case 'human':
      return 'You'
    case 'lead':
      return lane.name ?? 'lead'
    case 'subagent':
      return lane.name ?? 'subagent'
  }
}

function clockOf(date: Date, withSeconds = false): string {
  const base = `${pad(date.getHours())}:${pad(date.getMinutes())}`
  return withSeconds ? `${base}:${pad(date.getSeconds())}` : base
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)]
}
