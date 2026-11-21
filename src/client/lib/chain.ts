// src/client/lib/chain.ts
//
// 调用链的纯展示逻辑：行文案、泳道身份与颜色、几何位置、事实与影响范围。
//
// 影响范围是**推断**：账本只能证明「谁在什么时候跟谁说过话」，不能证明因果，
// 所以界面上必须与「收到后它做了什么」分开说。

import type {
  AgentLaneView,
  ChainRow,
  LiveRow,
  MilestoneKind,
} from '../../shared/ticket-detail.ts'
import type { TicketView } from '../../shared/tickets.ts'
import type { Dict, Translate } from '../i18n.ts'

/** rail 固定宽度：泳道列是整条链的骨架，不随泳道数伸缩。 */
export const RAIL_WIDTH = 96
/** 泳道间距与起点：与 mockup 一致（x = 12 + 16i）。 */
const LANE_START_X = 12
const LANE_GAP_X = 16
/** 影响范围最多列几行：再多就不像因果，像整条链。 */
const IMPACT_LIMIT = 5
/** router 不在泳道里，它的投递从 rail 最左侧伸进来。 */
export const ROUTER_X = 4

/** 行高：里程碑 24、投递 34、扇出 50（与 mockup 一致）。 */
export function rowHeight(kind: ChainRow['kind']): number {
  if (kind === 'milestone' || kind === 'dispatch') return 24
  if (kind === 'fan') return 50
  if (kind === 'live') return 0
  return 34
}

export function laneX(index: number): number {
  return LANE_START_X + LANE_GAP_X * index
}

/** 泳道身份色：宿主 token 里没有 Agent 身份，这一组是本插件自建的。 */
const LANE_COLORS = {
  human: '#C9C9D0',
  lead: '#5B8CFF',
  reviewer: '#3FB9A1',
  architect: '#E0A24A',
  frontend: '#A98BFF',
  fallback: '#8A93A6',
} as const

export const ROUTER_COLOR = '#8A93A6'

export function laneDisplayName(t: Translate, lane: AgentLaneView): string {
  if (lane.role === 'human') return t('chainWhoHuman')
  if (lane.role === 'router') return t('chainWhoRouter')
  if (lane.name !== undefined && lane.name.length > 0) return lane.name
  return lane.role === 'lead' ? 'lead' : t('chainWhoSubagent')
}

/** chip 上的列号：人 1、负责人 2、子代理 3… 与 mockup 一致。 */
export function laneIndexLabel(lane: AgentLaneView): string {
  return String(lane.index + 1)
}

export function laneColorHex(lane: AgentLaneView): string {
  if (lane.role === 'human') return LANE_COLORS.human
  if (lane.role === 'lead') return LANE_COLORS.lead
  const name = lane.name?.toLowerCase() ?? ''
  if (name.includes('review')) return LANE_COLORS.reviewer
  if (name.includes('architect')) return LANE_COLORS.architect
  if (name.includes('front')) return LANE_COLORS.frontend
  return LANE_COLORS.fallback
}

export interface LaneState {
  label: string
  state: 'running' | 'live' | 'done'
}

/**
 * chip 右侧的状态：只写此刻能读到的事实。
 *
 * 人：有过决定才写「已批准」；负责人：工单结束了就写结局，否则写轮次；
 * 子代理：正在跑写轮次，其余写「已结束」。
 */
export function laneState(
  t: Translate,
  lane: AgentLaneView,
  ticket: TicketView,
  approved: boolean,
): LaneState | undefined {
  if (lane.role === 'human') {
    return approved ? { label: t('chainChipApproved'), state: 'live' } : undefined
  }
  if (lane.role === 'lead' && ticket.stage === 'ended') {
    return {
      label: t(ticket.outcome === 'failed' ? 'chainChipFailed' : 'chainChipDone'),
      state: 'done',
    }
  }
  if (lane.status === 'running' && lane.currentTurn !== undefined) {
    return { label: t('chainChipTurn', { turn: lane.currentTurn }), state: 'running' }
  }
  if (lane.role === 'subagent') return { label: t('chainChipDone'), state: 'done' }
  return undefined
}

const MILESTONE_KEYS: Record<MilestoneKind, keyof Dict> = {
  queued: 'chainMilestoneQueued',
  'queue-busy': 'chainMilestoneQueueBusy',
  'queue-capacity': 'chainMilestoneQueueCapacity',
  interrupted: 'chainMilestoneInterrupted',
  resumed: 'chainMilestoneResumed',
  'approval-discarded': 'chainMilestoneApprovalDiscarded',
  closed: 'chainMilestoneClosed',
  failed: 'chainMilestoneFailed',
}

/** 里程碑行的一句话：不画边，只解释「停在哪、为什么停」。 */
export function milestoneText(t: Translate, row: ChainRow): string {
  if (row.kind === 'dispatch') return t('chainBrief')
  if (row.kind !== 'milestone') return ''
  const base = t(MILESTONE_KEYS[row.milestone])
  return row.detail === undefined ? base : `${base} · ${row.detail}`
}

export type ChainBadgeTone = 'sp' | 'up' | 'ok' | 'plain' | 'warn' | 'err'

export interface ChainBadge {
  label: string
  tone: ChainBadgeTone
}

/** 行首那枚小徽标：这一行把信息拿过去做什么。 */
export function chainBadge(t: Translate, row: ChainRow): ChainBadge | undefined {
  switch (row.kind) {
    case 'spawn':
      return { label: t('chainBadgeSpawn'), tone: 'sp' }
    case 'hop':
      if (row.direction === 'up') return { label: t('chainBadgeReport'), tone: 'up' }
      if (row.direction === 'lateral') return { label: t('chainBadgeSync'), tone: 'plain' }
      return { label: t('chainBadgeDispatch'), tone: 'sp' }
    case 'fan':
      return { label: t('chainBadgeFan'), tone: 'sp' }
    case 'supplement':
      return { label: t('chainBadgeSupplement'), tone: 'warn' }
    case 'approval':
      if (row.phase === 'request') return { label: t('chainBadgeApproval'), tone: 'plain' }
      if (row.decision === 'skipped') return { label: t('chainBadgeSkipped'), tone: 'plain' }
      return {
        label: t(row.decision === 'answered' ? 'chainBadgeAnswered' : 'chainBadgeApproved'),
        tone: 'ok',
      }
    default:
      return undefined
  }
}

/** 行的内容行（第二行）；里程碑与决定没有。 */
export function chainRowSummary(row: ChainRow): string | undefined {
  switch (row.kind) {
    case 'dispatch':
    case 'supplement':
    case 'spawn':
    case 'hop':
      return row.summary
    case 'approval':
      return row.phase === 'request' ? row.summary : row.summary.length === 0 ? undefined : row.summary
    case 'fan':
      return undefined
    default:
      return undefined
  }
}

/** 一行的两端：rail 上的连线从 from 画到每个 to。 */
export function chainRowLink(row: ChainRow): { from: string; to: string[] } | undefined {
  switch (row.kind) {
    case 'dispatch':
    case 'supplement':
      return { from: 'router', to: [row.to] }
    case 'spawn':
    case 'hop':
      return { from: row.from, to: [row.to] }
    case 'fan':
      return { from: row.from, to: row.to.map(target => target.sessionId) }
    case 'approval':
      return row.phase === 'request'
        ? { from: row.from, to: ['human'] }
        : { from: 'human', to: [row.to] }
    default:
      return undefined
  }
}

/** 线的颜色：审批请求是中性灰，决定是绿色，其余跟随发送方身份色。 */
export function chainLinkColor(row: ChainRow, fromColor: string): string {
  if (row.kind === 'approval') {
    return row.phase === 'request' ? '#C9C9D0' : '#4FC38A'
  }
  return fromColor
}

export function liveText(t: Translate, row: LiveRow, lane: AgentLaneView | undefined): string {
  if (row.live === 'waiting-approval') return t('chainLiveWaitingApproval')
  if (row.live === 'running' && row.turn !== undefined) {
    return lane === undefined
      ? t('chainLiveRunningNoTurn')
      : t('chainLiveRunning', { who: laneDisplayName(t, lane), turn: row.turn })
  }
  return lane === undefined ? t('chainLiveWaitingAgent') : t('chainLiveWaitingOn', { who: laneDisplayName(t, lane) })
}

/** 时长：秒 / 分秒 / 分 / 小时四档。 */
export function formatDuration(t: Translate, ms: number): string {
  const seconds = Math.max(1, Math.round(ms / 1000))
  if (seconds < 60) return t('durationSeconds', { count: seconds })
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) {
    const rest = seconds % 60
    return rest === 0
      ? t('durationMinutes', { count: minutes })
      : t('durationMinutesSeconds', { minutes, seconds: rest })
  }
  return t('durationHours', { count: Math.floor(minutes / 60) })
}

/** 时间戳：行上一律 HH:MM。 */
export function formatClock(at: number): string {
  const date = new Date(at)
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** token 数：四位数以上压成 `38.2k`，窄栏里不占位。 */
export function formatTokens(tokens: number): string {
  if (tokens < 1000) return String(tokens)
  const thousands = tokens / 1000
  return `${thousands >= 100 ? Math.round(thousands) : thousands.toFixed(1)}k`
}

/** 目录的短写法：`work/t-4c1b77`，折叠行右侧用它。 */
export function shortDirectory(directory: string | undefined): string | undefined {
  if (directory === undefined) return undefined
  const parts = directory.split(/[\\/]/).filter(part => part.length > 0)
  if (parts.length === 0) return directory
  return `work/${parts[parts.length - 1]}`
}

/** `09:07–09:11` 这种跨分钟区间；同分钟只写一次。 */
export function formatClockRange(t: Translate, start: number, end: number): string {
  const from = formatClock(start)
  const to = formatClock(end)
  return from === to ? from : `${from}–${to}`
}

/**
 * 收到这条信息之后，接收方自己做了什么（事实）。
 *
 * 只取接收方发出的行：它可能投递给别人、派发子代理、提交审批。
 */
export function factsAfter(rows: readonly ChainRow[], row: ChainRow): ChainRow[] {
  const receiver = receiverOf(row)
  if (receiver === undefined) return []
  const facts: ChainRow[] = []
  for (const candidate of rows) {
    if (candidate.id === row.id || candidate.at < row.at) continue
    if (!belongsTo(candidate, receiver)) continue
    facts.push(candidate)
  }
  return facts
}

/** 这一行是否由该会话发起：投递看发送方，审批请求看提问方。 */
function belongsTo(row: ChainRow, sessionId: string): boolean {
  if (row.kind === 'approval') return row.phase === 'request' && row.from === sessionId
  return senderOf(row) === sessionId
}

/**
 * 可能被这一行影响的下游：从接收方出发，沿着后续的投递/派发一路往下。
 *
 * 这是推断而不是因果：账本证明不了「因为收到 A 才做了 B」，只能说明时间与
 * 送达关系上都接得上。界面用「可能」措辞，不与事实混在一起。
 */
export function impactRows(rows: readonly ChainRow[], row: ChainRow): ChainRow[] {
  const receiver = receiverOf(row)
  if (receiver === undefined) return []
  const reachable = new Set<string>([receiver])
  const impact: ChainRow[] = []
  for (const candidate of rows) {
    if (candidate.id === row.id || candidate.at < row.at) continue
    const sender = senderOf(candidate)
    if (sender === undefined || !reachable.has(sender)) continue
    for (const target of receiversOf(candidate)) reachable.add(target)
    impact.push(candidate)
    if (impact.length >= IMPACT_LIMIT) break
  }
  return impact
}

function senderOf(row: ChainRow): string | undefined {
  switch (row.kind) {
    case 'dispatch':
    case 'supplement':
      return 'router'
    case 'spawn':
    case 'hop':
      return row.from
    case 'fan':
      return row.from
    default:
      return undefined
  }
}

function receiversOf(row: ChainRow): string[] {
  switch (row.kind) {
    case 'dispatch':
    case 'supplement':
    case 'spawn':
    case 'hop':
      return [row.to]
    case 'fan':
      return row.to.map(target => target.sessionId)
    case 'approval':
      return [row.to]
    default:
      return []
  }
}

function receiverOf(row: ChainRow): string | undefined {
  return receiversOf(row)[0]
}
