// src/client/lib/chain.ts
//
// 调用链的纯展示逻辑：行文案、泳道身份与颜色、几何位置、影响范围。
//
// 影响范围是**推断**：账本只能证明「谁在什么时候跟谁说过话」，不能证明因果。
// 因此这里给的是「顺着链往下游可能受影响的行」，界面必须用「可能」措辞。

import type {
  AgentLaneView,
  ChainRow,
  LiveRow,
  MilestoneKind,
} from '../../shared/ticket-detail.ts'
import type { Dict, Translate } from '../i18n.ts'

/** 链行的色调；组件层再映射到官方 Tag。 */
export type ChainTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

/** 影响范围最多列几行：再多就不像因果，像整条链。 */
const IMPACT_LIMIT = 5
/** 「收到后它做了什么」最多列几件事实。 */
const FACTS_LIMIT = 3

/** 泳道身份色：宿主 token 里没有 Agent 身份，这一组是本插件自建的。 */
const LANE_COLORS = {
  router: '#8A93A6',
  human: '#C9C9D0',
  lead: '#5B8CFF',
  reviewer: '#3FB9A1',
  architect: '#E0A24A',
  frontend: '#A98BFF',
  fallback: '#7C8698',
} as const

/** 车道起点与间距：rail 是一条窄条，x 由泳道序号算出。 */
const LANE_START_X = 12
const LANE_GAP_X = 16

export function laneX(index: number): number {
  return LANE_START_X + LANE_GAP_X * index
}

/** rail 宽度跟着泳道数走：多一列就宽一点，而不是把点挤在一起。 */
export function railWidth(laneCount: number): number {
  return laneX(Math.max(0, laneCount - 1)) + 8
}

export function laneDisplayName(t: Translate, lane: AgentLaneView): string {
  if (lane.role === 'router') return t('chainRoleRouter')
  if (lane.role === 'human') return t('chainRoleHuman')
  if (lane.name !== undefined && lane.name.length > 0) return lane.name
  if (lane.role === 'lead') return t('chainRoleLead')
  return t('chainRoleSubagent')
}

/** chip 上的位置标记：router 轨用 R，其余用列号。 */
export function laneIndexLabel(lane: AgentLaneView): string {
  return lane.role === 'router' ? 'R' : String(lane.index)
}

export function laneColorHex(lane: AgentLaneView): string {
  if (lane.role === 'router') return LANE_COLORS.router
  if (lane.role === 'human') return LANE_COLORS.human
  if (lane.role === 'lead') return LANE_COLORS.lead
  const name = lane.name?.toLowerCase() ?? ''
  if (name.includes('review')) return LANE_COLORS.reviewer
  if (name.includes('architect')) return LANE_COLORS.architect
  if (name.includes('front')) return LANE_COLORS.frontend
  return LANE_COLORS.fallback
}

const MILESTONE_LABEL_KEYS: Record<MilestoneKind, keyof Dict> = {
  queued: 'chainMilestoneQueued',
  'queue-busy': 'chainMilestoneQueueBusy',
  'queue-capacity': 'chainMilestoneQueueCapacity',
  interrupted: 'chainMilestoneInterrupted',
  resumed: 'chainMilestoneResumed',
  'approval-discarded': 'chainMilestoneApprovalDiscarded',
  closed: 'chainMilestoneClosed',
  failed: 'chainMilestoneFailed',
}

export function chainRowLabel(t: Translate, row: ChainRow): string {
  switch (row.kind) {
    case 'dispatch':
      return t(row.mode === 'append' ? 'chainAppend' : 'chainDispatch')
    case 'supplement':
      return t('chainSupplement')
    case 'spawn':
      return t('chainSpawn')
    case 'hop':
      return t('chainHop')
    case 'fan':
      return t('chainFan', { count: row.to.length })
    case 'approval':
      return t(row.phase === 'request' ? 'chainApprovalRequest' : 'chainApprovalDecision')
    case 'milestone':
      return t(MILESTONE_LABEL_KEYS[row.milestone])
    case 'live':
      return liveLabel(t, row)
  }
}

/** 行上的次要内容：一段事实（消息摘要/任务摘要），里程碑与决定没有。 */
export function chainRowSummary(row: ChainRow): string | undefined {
  switch (row.kind) {
    case 'dispatch':
    case 'supplement':
    case 'spawn':
    case 'hop':
      return row.summary
    case 'approval':
      return row.phase === 'request' ? row.summary : undefined
    default:
      return undefined
  }
}

export function chainRowTone(row: ChainRow): ChainTone {
  switch (row.kind) {
    case 'milestone':
      if (row.milestone === 'failed') return 'danger'
      if (row.milestone === 'interrupted' || row.milestone.startsWith('queue')) return 'warning'
      if (row.milestone === 'closed') return 'success'
      return 'neutral'
    case 'approval':
      return row.phase === 'request' ? 'warning' : 'success'
    case 'supplement':
      return 'info'
    case 'live':
      return row.live === 'waiting-approval' ? 'warning' : 'info'
    default:
      return 'neutral'
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

export function liveLabel(t: Translate, row: LiveRow): string {
  if (row.live === 'waiting-approval') return t('chainLiveWaitingApproval')
  if (row.live === 'waiting-agent') return t('chainLiveWaitingAgent')
  return row.turn === undefined ? t('chainLiveRunningNoTurn') : t('chainLiveRunning', { turn: row.turn })
}

/** 时长文案：秒、分秒、分、小时四档，够用又不啰嗦。 */
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

/**
 * 收到这条信息之后，接收方自己做了什么（事实）。
 *
 * 只取接收方发出的行：它可能投递给别人、派发子代理、提交审批或在里程碑里停下。
 */
export function factsAfter(rows: readonly ChainRow[], row: ChainRow): ChainRow[] {
  const receiver = receiverOf(row)
  if (receiver === undefined) return []
  const facts: ChainRow[] = []
  for (const candidate of rows) {
    if (candidate.id === row.id || candidate.at < row.at) continue
    if (!belongsTo(candidate, receiver)) continue
    facts.push(candidate)
    if (facts.length >= FACTS_LIMIT) break
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
