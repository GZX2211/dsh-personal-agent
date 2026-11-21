// src/host/projector/ticket-detail.ts
//
// 工单详情的推导：账本事实 + 已裁剪的会话窗口 → 链视图。纯函数，输入即全部事实，
// 不读环境、不读文件。
//
// 链只画两类边：账本事件（派发/补充/审批/中断/关闭）与「有地址的主动投递」
// （一个 Agent 明确发给另一个 Agent 的消息）。工具返回、子代理完成通知是回执，
// 不是影响边，因此不画。

import type { SessionEvent } from '@deepseek-ai/dsh-session'
import type { L2Event, TaskMode } from '../../shared/events.ts'
import type {
  AgentLaneView,
  ApprovalRow,
  ChainRow,
  DetailLogState,
  DetailOrigin,
  DispatchRow,
  FanRow,
  HopRow,
  LiveRow,
  MilestoneKind,
  MilestoneRow,
  SpawnRow,
  SupplementRow,
  TicketDeliveryView,
  TicketDetailMetrics,
  TicketDetailResponse,
} from '../../shared/ticket-detail.ts'
import type { TicketView } from '../../shared/tickets.ts'

/** 单条链文本的上限：够读完一段上下文，又不至于把轮询撑爆。 */
const TEXT_LIMIT = 4000
/** 行摘要长度：一行装得下的量。 */
const SUMMARY_LIMIT = 120
/** 扇出合并窗口：同一父级在这段时间内的连续 spawn 视为一次并行派发。 */
const FAN_WINDOW_MS = 10_000

/** 会话日志里的一条子代理登记；catalog 不受时间窗口裁剪。 */
export interface DetailSessionChild {
  childId: string
  childCreatedAt: number
  name?: string
  label?: string
}

/** 详情推导看到的单个会话：窗口内事件 + 整份日志的子代理登记 + 读取质量。 */
export interface DetailSessionInput {
  events: readonly SessionEvent[]
  children: readonly DetailSessionChild[]
  completeness: DetailLogState
  reason?: string
}

export interface TicketDetailInput {
  ticket: TicketView
  ledger: readonly L2Event[]
  /** 按 sessionId 索引；排队中的工单为空映射。 */
  sessions: ReadonlyMap<string, DetailSessionInput>
  now: number
}

export function deriveTicketDetail(input: TicketDetailInput): TicketDetailResponse {
  const { ticket, sessions, now } = input
  const ledger = orderedBySeq(input.ledger)
  const events = selectTicketEvents(ledger, ticket.id)
  // 窗口起点是「这一单开始执行」：追加单共用会话，上一单的历史必须被裁掉。
  const start = ticket.dispatchedAt ?? ticket.createdAt
  const end = ticket.endedAt ?? now

  const queued = events.find(event => event.type === 'task/queued')
  const mode: TaskMode = queued?.type === 'task/queued' ? queued.payload.mode : 'dispatch'
  const requestedBySessionId =
    queued?.type === 'task/queued' ? queued.payload.requestedBySessionId : undefined

  const context: RowContext = { ticket, events, sessions, start, end, now, requestedBySessionId }
  const rows = buildRows(context)
  const lanes = buildLanes(context, rows)
  const live = buildLive(context, lanes)
  if (live !== undefined) rows.push(live)

  return {
    ticket,
    mode,
    origin: buildOrigin(ledger, events, requestedBySessionId),
    lanes,
    rows,
    delivery: buildDelivery(context),
    metrics: countMetrics(rows, lanes, sessions, start, end),
    completeness: aggregateCompleteness(ticket, sessions),
    generatedAt: now,
  }
}

interface RowContext {
  ticket: TicketView
  events: readonly L2Event[]
  sessions: ReadonlyMap<string, DetailSessionInput>
  start: number
  end: number
  now: number
  requestedBySessionId?: string
}

/** 这张单为什么存在：找到它对应的决定，再顺着决定找到那条输入。 */
function buildOrigin(
  ledger: readonly L2Event[],
  events: readonly L2Event[],
  requestedBySessionId: string | undefined,
): DetailOrigin {
  const origin: DetailOrigin = {}
  // 补充也是本单的决定，但它不解释「这张单怎么来的」。
  const decision = events.find(
    event =>
      event.type === 'decision/recorded' &&
      (event.payload.action === 'dispatch' || event.payload.action === 'append'),
  )
  if (decision?.type === 'decision/recorded') {
    origin.decision = {
      action: decision.payload.action,
      at: decision.time,
      ...(decision.payload.inferred === true ? { inferred: true } : {}),
    }
    const signal = ledger.find(
      event => event.type === 'signal/received' && event.payload.signalId === decision.payload.signalId,
    )
    if (signal?.type === 'signal/received') {
      origin.signal = {
        kind: signal.payload.kind,
        receivedAt: signal.payload.receivedAt,
        ...(signal.payload.text === undefined ? {} : { text: signal.payload.text }),
        ...(signal.payload.sourceName === undefined ? {} : { sourceName: signal.payload.sourceName }),
        ...(signal.payload.threadName === undefined ? {} : { threadName: signal.payload.threadName }),
      }
    }
  }
  if (requestedBySessionId !== undefined) origin.requestedBySessionId = requestedBySessionId
  return origin
}

function buildRows(context: RowContext): ChainRow[] {
  const rows = [...ledgerRows(context), ...sessionRows(context)]
  // 同一毫秒内的先后由插入顺序决定：账本行先于会话行，子级 spawn 先于子级投递。
  return mergeFans(rows).sort((left, right) => left.at - right.at)
}

/**
 * 同一父级在短窗口内的连续 spawn 合并成一次并行派发。
 *
 * 只合并 spawn：投递是按条看的信息流，合并了就数不清谁说了几次。
 */
function mergeFans(rows: readonly ChainRow[]): ChainRow[] {
  const merged: ChainRow[] = []
  let index = 0
  while (index < rows.length) {
    const row = rows[index]
    if (row === undefined || row.kind !== 'spawn') {
      if (row !== undefined) merged.push(row)
      index += 1
      continue
    }
    const group: SpawnRow[] = [row]
    let next = index + 1
    for (; next < rows.length; next += 1) {
      const candidate = rows[next]
      if (candidate === undefined || candidate.kind !== 'spawn') break
      if (candidate.from !== row.from || candidate.at - row.at > FAN_WINDOW_MS) break
      group.push(candidate)
    }
    if (group.length === 1) {
      merged.push(row)
      index += 1
      continue
    }
    const fan: FanRow = {
      id: `fan:${row.from}:${row.at}`,
      kind: 'fan',
      at: row.at,
      from: row.from,
      to: group.map(item => ({ sessionId: item.to, summary: item.summary })),
    }
    merged.push(fan)
    index = next
  }
  return merged
}

function ledgerRows(context: RowContext): ChainRow[] {
  const rows: ChainRow[] = []
  const requesters = approvalRequesters(context.events)
  for (const event of context.events) {
    switch (event.type) {
      case 'task/queued': {
        const milestone = queueMilestone(event.payload.queueReason, context.ticket.stage)
        if (milestone === undefined) break
        rows.push({
          id: `milestone:${event.seq}`,
          kind: 'milestone',
          at: event.time,
          milestone,
        })
        break
      }
      case 'task/dispatched': {
        const brief = findBrief(context, event.payload.workerSessionId)
        rows.push({
          id: `dispatch:${event.seq}`,
          kind: 'dispatch',
          at: event.time,
          from: 'router',
          to: event.payload.workerSessionId,
          mode: event.payload.mode,
          summary: brief?.summary ?? context.ticket.title,
          ...(brief === undefined ? {} : { text: brief.text, anchor: { sessionId: event.payload.workerSessionId, seq: brief.seq } }),
        })
        break
      }
      case 'task/supplemented': {
        rows.push({
          id: `supplement:${event.seq}`,
          kind: 'supplement',
          at: event.time,
          from: 'router',
          to: event.payload.targetSessionId,
          summary: firstLine(event.payload.text, SUMMARY_LIMIT),
          text: truncate(event.payload.text, TEXT_LIMIT),
        })
        break
      }
      case 'task/interrupted': {
        rows.push({
          id: `milestone:${event.seq}`,
          kind: 'milestone',
          at: event.time,
          milestone: 'interrupted',
          detail: event.payload.reason,
          ...(event.sessionId === undefined ? {} : { lane: event.sessionId }),
        })
        break
      }
      case 'task/resumed': {
        rows.push({
          id: `milestone:${event.seq}`,
          kind: 'milestone',
          at: event.time,
          milestone: 'resumed',
          ...(event.sessionId === undefined ? {} : { lane: event.sessionId }),
        })
        break
      }
      case 'task/closed': {
        rows.push({
          id: `milestone:${event.seq}`,
          kind: 'milestone',
          at: event.time,
          milestone: event.payload.outcome === 'completed' ? 'closed' : 'failed',
          ...(event.payload.reason === undefined ? {} : { detail: event.payload.reason }),
        })
        break
      }
      case 'approval/pending': {
        rows.push({
          id: `approval:${event.seq}`,
          kind: 'approval',
          phase: 'request',
          at: event.time,
          from: event.payload.requestedBySessionId,
          to: 'human',
          summary: firstLine(event.payload.question, SUMMARY_LIMIT),
          options: event.payload.options.map(option => option.label),
          ...(event.payload.risk === undefined ? {} : { risk: event.payload.risk }),
        })
        break
      }
      case 'approval/decided': {
        const decision = event.payload.decision
        rows.push({
          id: `approval:${event.seq}`,
          kind: 'approval',
          phase: 'decision',
          at: event.time,
          from: 'human',
          // 决定送回给提问的那个会话；找不到提问方时留在人这条道上。
          to: requesters.get(event.payload.approvalId) ?? 'human',
          summary: firstLine(decisionSummary(decision), SUMMARY_LIMIT),
          decision: decision.kind,
        })
        break
      }
      case 'approval/discarded': {
        rows.push({
          id: `milestone:${event.seq}`,
          kind: 'milestone',
          at: event.time,
          milestone: 'approval-discarded',
          detail: event.payload.reason,
        })
        break
      }
      default:
        break
    }
  }
  return rows
}

/** 每个审批是谁提的：决定行要靠它找到送回的对象。 */
function approvalRequesters(events: readonly L2Event[]): Map<string, string> {
  const requesters = new Map<string, string>()
  for (const event of events) {
    if (event.type === 'approval/pending') {
      requesters.set(event.payload.approvalId, event.payload.requestedBySessionId)
    }
  }
  return requesters
}

function decisionSummary(decision: { kind: string; label?: string; index?: number; answer?: string }): string {
  if (decision.kind === 'answered') return decision.answer ?? ''
  if (decision.kind === 'selected') return decision.label ?? `#${decision.index ?? 0}`
  return ''
}

/** 排队里程碑只在「真的等过」或「还在等」时才有意义：秒放的工单不需要一段排队故事。 */
function queueMilestone(
  reason: 'worker-busy' | 'capacity-full' | undefined,
  stage: TicketView['stage'],
): MilestoneKind | undefined {
  if (stage === 'queued') {
    if (reason === 'worker-busy') return 'queue-busy'
    if (reason === 'capacity-full') return 'queue-capacity'
    return 'queued'
  }
  // 已放行：只有排队原因能解释「为什么晚开始」，没有原因就不画。
  if (reason === 'worker-busy') return 'queue-busy'
  if (reason === 'capacity-full') return 'queue-capacity'
  return undefined
}

function sessionRows(context: RowContext): ChainRow[] {
  const rows: ChainRow[] = []
  const spawned = new Set<string>()
  for (const sessionId of orderedSessionIds(context)) {
    const facts = context.sessions.get(sessionId)
    if (facts === undefined) continue
    rows.push(...spawnRows(context, sessionId, facts, spawned))
    for (const event of facts.events) rows.push(...messageRow(context, sessionId, event))
  }
  return rows
}

/** 子代理登记里落在窗口内的才画 spawn 行：复用来的旧子代理只画它在窗口内的投递。 */
function spawnRows(
  context: RowContext,
  parentId: string,
  facts: DetailSessionInput,
  spawned: Set<string>,
): SpawnRow[] {
  const rows: SpawnRow[] = []
  for (const child of facts.children) {
    if (spawned.has(child.childId)) continue
    spawned.add(child.childId)
    if (child.childCreatedAt < context.start || child.childCreatedAt > context.end) continue
    const task = firstUserMessage(context.sessions.get(child.childId)?.events ?? [])
    rows.push({
      id: `spawn:${child.childId}`,
      kind: 'spawn',
      at: child.childCreatedAt,
      from: parentId,
      to: child.childId,
      summary:
        task === undefined
          ? (child.name ?? child.label ?? child.childId)
          : firstLine(task, SUMMARY_LIMIT),
      ...(task === undefined ? {} : { text: truncate(task, TEXT_LIMIT) }),
    })
  }
  return rows
}

/** 一条 Agent 主动投递 → 一条 hop；工具返回与完成通知是回执，不画。 */
function messageRow(context: RowContext, sessionId: string, event: SessionEvent): ChainRow[] {
  if (event.type !== 'user/message') return []
  const message = event.data as {
    content?: readonly { type: string; text?: string }[]
    source?: { kind?: string; senderSessionId?: string }
  }
  const source = message.source
  if (source?.kind !== 'agent-message' || typeof source.senderSessionId !== 'string') return []
  const sender = source.senderSessionId
  if (sender === sessionId) return []
  const text = stripAgentPrefix(joinText(message.content))
  if (text.length === 0) return []
  const direction = relationOf(context, sender, sessionId)
  return [
    {
      id: `hop:${sessionId}:${event.seq}`,
      kind: 'hop',
      at: event.time,
      from: sender,
      to: sessionId,
      direction,
      summary: firstLine(text, SUMMARY_LIMIT),
      text: truncate(text, TEXT_LIMIT),
      anchor: { sessionId, seq: event.seq },
    } satisfies HopRow,
  ]
}

/** 父→子是向下，子→父是向上，兄弟之间是平级。 */
function relationOf(context: RowContext, from: string, to: string): 'down' | 'up' | 'lateral' {
  const root = context.ticket.workerSessionId
  if (from === root) return 'down'
  if (to === root) return 'up'
  return 'lateral'
}

/**
 * 泳道：人（若参与）在最左，然后是负责人与子代理。
 *
 * router 不占泳道：它没有执行过程，派单只体现为「简报投递」那一行。把 router 画成
 * 一列会让真正有过程的会话整体右移一列，窄栏里读起来更挤。
 */
function buildLanes(context: RowContext, rows: readonly ChainRow[]): AgentLaneView[] {
  const lanes: AgentLaneView[] = []

  if (context.events.some(event => event.type === 'approval/pending')) {
    lanes.push({ id: 'human', index: 0, role: 'human', status: 'idle' })
  }

  const root = context.ticket.workerSessionId
  if (root !== undefined) lanes.push(laneOf(context, root, 'lead', undefined))

  for (const id of childOrder(context, rows)) {
    if (id === root) continue
    lanes.push(laneOf(context, id, 'subagent', parentOf(context, id)))
  }
  // 列顺序就是泳道顺序：人最左，负责人其次，然后按出现顺序排列子代理。
  lanes.forEach((lane, index) => {
    lane.index = index
  })
  return lanes
}

/** child 的父级：谁在 catalog 里登记了它。 */
function parentOf(context: RowContext, childId: string): string | undefined {
  for (const [sessionId, facts] of context.sessions) {
    if (facts.children.some(child => child.childId === childId)) return sessionId
  }
  return undefined
}

function childName(context: RowContext, childId: string): string | undefined {
  for (const facts of context.sessions.values()) {
    const child = facts.children.find(item => item.childId === childId)
    if (child !== undefined) return child.name ?? child.label
  }
  return undefined
}

/**
 * 子级的出现顺序：catalog 创建顺序优先，其次是链上出现过的参与者。
 *
 * 复用的旧子代理不在本单的窗口里创建，但它在本单参与了投递，所以仍要进图，
 * 否则它的消息会指向一条不存在的泳道。
 */
function childOrder(context: RowContext, rows: readonly ChainRow[]): string[] {
  const order: string[] = []
  const push = (id: string | undefined): void => {
    if (id === undefined || id === 'router' || id === 'human') return
    if (!order.includes(id)) order.push(id)
  }
  for (const sessionId of orderedSessionIds(context)) {
    for (const child of context.sessions.get(sessionId)?.children ?? []) push(child.childId)
  }
  for (const row of rows) {
    switch (row.kind) {
      case 'hop':
        // 投递的两端都是参与者：只发不收的会话同样要在图里有一列。
        push(row.from)
        push(row.to)
        break
      case 'spawn':
        push(row.to)
        break
      case 'fan':
        for (const target of row.to) push(target.sessionId)
        break
      default:
        break
    }
  }
  return order
}

function laneOf(
  context: RowContext,
  sessionId: string,
  role: 'lead' | 'subagent',
  parentId: string | undefined,
): AgentLaneView {
  const facts = context.sessions.get(sessionId)
  const stats = laneStats(facts)
  const lane: AgentLaneView = {
    id: sessionId,
    index: 0,
    role,
    status: laneStatus(context, sessionId, facts, stats.openTurn),
    turns: stats.turns,
    tokens: stats.tokens,
    sessionId,
  }
  const name = role === 'lead' ? 'lead' : childName(context, sessionId)
  if (name !== undefined) lane.name = name
  if (parentId !== undefined) lane.parentId = parentId
  if (stats.openTurn !== undefined) lane.currentTurn = stats.openTurn
  return lane
}

interface LaneStats {
  turns: number
  tokens: number
  openTurn?: number
}

function laneStats(facts: DetailSessionInput | undefined): LaneStats {
  const stats: LaneStats = { turns: 0, tokens: 0 }
  if (facts === undefined) return stats
  let lastStart: number | undefined
  let lastEnd: number | undefined
  for (const event of facts.events) {
    if (event.type === 'turn/start') {
      stats.turns += 1
      lastStart = (event.data as { turn: number }).turn
      continue
    }
    if (event.type === 'turn/end') {
      lastEnd = (event.data as { turn: number }).turn
      continue
    }
    if (event.type === 'assistant/message') {
      stats.tokens += tokensOf((event.data as { usage?: Usage }).usage)
    }
  }
  if (lastStart !== undefined && lastStart !== lastEnd) stats.openTurn = lastStart
  return stats
}

interface Usage {
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  cacheReadTokens?: number
  cacheWriteTokens?: number
}

function tokensOf(usage: Usage | undefined): number {
  if (usage === undefined) return 0
  if (typeof usage.totalTokens === 'number') return usage.totalTokens
  return (
    (usage.inputTokens ?? 0) +
    (usage.outputTokens ?? 0) +
    (usage.cacheReadTokens ?? 0) +
    (usage.cacheWriteTokens ?? 0)
  )
}

function laneStatus(
  context: RowContext,
  sessionId: string,
  facts: DetailSessionInput | undefined,
  openTurn: number | undefined,
): AgentLaneView['status'] {
  if (context.ticket.workerSessionId === sessionId) {
    if (context.ticket.stage === 'ended') return 'done'
    if (context.ticket.stage === 'blocked') return 'blocked'
  }
  if (openTurn !== undefined) return 'running'
  if (facts === undefined || facts.completeness === 'unavailable') return 'unknown'
  return 'idle'
}

function buildLive(context: RowContext, lanes: readonly AgentLaneView[]): LiveRow | undefined {
  if (context.ticket.stage === 'ended' || context.ticket.stage === 'queued') return undefined
  // 有未决审批时，这一单等的是人：补充或新的投递都不会替人做这个决定。
  const pending = pendingApproval(context.events)
  if (pending !== undefined) {
    return {
      id: 'live:human',
      kind: 'live',
      at: context.now,
      lane: 'human',
      live: 'waiting-approval',
      waitingOn: pending.requestedBySessionId,
    }
  }
  const active = lanes.find(lane => lane.status === 'running' && lane.role !== 'human')
  if (active !== undefined) {
    return {
      id: `live:${active.id}`,
      kind: 'live',
      at: context.now,
      lane: active.id,
      live: 'running',
      ...(active.currentTurn === undefined ? {} : { turn: active.currentTurn }),
    }
  }
  const root = context.ticket.workerSessionId
  if (root === undefined) return undefined
  return { id: 'live:ticket', kind: 'live', at: context.now, lane: root, live: 'waiting-agent', waitingOn: root }
}

/** 最后一条没有被决定/作废收口的审批。 */
function pendingApproval(events: readonly L2Event[]): { requestedBySessionId: string } | undefined {
  const closed = new Set<string>()
  for (const event of events) {
    if (event.type === 'approval/decided' || event.type === 'approval/discarded') {
      closed.add(event.payload.approvalId)
    }
  }
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]
    if (event !== undefined && event.type === 'approval/pending' && !closed.has(event.payload.approvalId)) {
      return { requestedBySessionId: event.payload.requestedBySessionId }
    }
  }
  return undefined
}

function buildDelivery(context: RowContext): TicketDeliveryView {
  const delivery: TicketDeliveryView = {}
  if (context.ticket.report !== undefined) delivery.report = context.ticket.report
  if (context.ticket.expectedOutput !== undefined) delivery.expectedOutput = context.ticket.expectedOutput
  if (context.ticket.outcome !== undefined) delivery.outcome = context.ticket.outcome
  const closed = [...context.events].reverse().find(event => event.type === 'task/closed')
  if (closed?.type === 'task/closed' && closed.payload.reason !== undefined) {
    delivery.reason = closed.payload.reason
  }
  return delivery
}

function countMetrics(
  rows: readonly ChainRow[],
  lanes: readonly AgentLaneView[],
  sessions: ReadonlyMap<string, DetailSessionInput>,
  start: number,
  end: number,
): TicketDetailMetrics {
  const hops = rows.filter((row): row is HopRow => row.kind === 'hop')
  let turns = 0
  let tokens = 0
  for (const facts of sessions.values()) {
    const stats = laneStats(facts)
    turns += stats.turns
    tokens += stats.tokens
  }
  return {
    agents: lanes.filter(lane => lane.role === 'lead' || lane.role === 'subagent').length,
    hops: hops.length,
    supplements: rows.filter(row => row.kind === 'supplement').length,
    parallel: maxFan(rows),
    pingPong: countPingPong(hops),
    turns,
    tokens,
    durationMs: Math.max(0, end - start),
  }
}

function maxFan(rows: readonly ChainRow[]): number {
  let max = 0
  for (const row of rows) {
    if (row.kind === 'fan' && row.to.length > max) max = row.to.length
  }
  return max
}

/** 相邻两条 hop 方向相反、中间没有别的投递：一问一答的来回。 */
function countPingPong(hops: readonly HopRow[]): number {
  let count = 0
  for (let index = 1; index < hops.length; index += 1) {
    const previous = hops[index - 1]
    const current = hops[index]
    if (previous === undefined || current === undefined) continue
    if (previous.from === current.to && previous.to === current.from) count += 1
  }
  return count
}

function aggregateCompleteness(
  ticket: TicketView,
  sessions: ReadonlyMap<string, DetailSessionInput>,
): { logs: DetailLogState; reason?: string } {
  const root = ticket.workerSessionId === undefined ? undefined : sessions.get(ticket.workerSessionId)
  if (ticket.workerSessionId === undefined) return { logs: 'full' }
  if (root === undefined || root.completeness === 'unavailable') {
    return {
      logs: 'unavailable',
      reason: root?.reason ?? `session log of ${ticket.workerSessionId} is unavailable`,
    }
  }
  for (const facts of sessions.values()) {
    if (facts.completeness !== 'full') {
      return { logs: 'partial', ...(facts.reason === undefined ? {} : { reason: facts.reason }) }
    }
  }
  return { logs: 'full' }
}

function orderedSessionIds(context: RowContext): string[] {
  const root = context.ticket.workerSessionId
  const ids = [...context.sessions.keys()]
  if (root === undefined || !context.sessions.has(root)) return ids
  return [root, ...ids.filter(id => id !== root)]
}

/** 本单的简要送达消息：它把「派发」这一行锚到 worker 日志的具体位置。 */
function findBrief(
  context: RowContext,
  sessionId: string,
): { seq: number; summary: string; text: string } | undefined {
  const facts = context.sessions.get(sessionId)
  if (facts === undefined) return undefined
  for (const event of facts.events) {
    if (event.type !== 'user/message') continue
    const message = event.data as {
      content?: readonly { type: string; text?: string }[]
      source?: { kind?: string; ticketId?: string; supplementId?: string }
    }
    const source = message.source
    if (source?.kind !== 'dsh-personal-agent' || source.ticketId !== context.ticket.id) continue
    if (source.supplementId !== undefined) continue
    const text = joinText(message.content)
    if (text.length === 0) continue
    return { seq: event.seq, summary: firstLine(text, SUMMARY_LIMIT), text: truncate(text, TEXT_LIMIT) }
  }
  return undefined
}

function firstUserMessage(events: readonly SessionEvent[]): string | undefined {
  for (const event of events) {
    if (event.type !== 'user/message') continue
    const text = joinText((event.data as { content?: readonly { type: string; text?: string }[] }).content)
    if (text.length > 0) return text
  }
  return undefined
}

function joinText(content: readonly { type: string; text?: string }[] | undefined): string {
  if (content === undefined) return ''
  return content
    .filter(block => block.type === 'text' && typeof block.text === 'string')
    .map(block => block.text as string)
    .join('')
    .trim()
}

/** DSH 会在 Agent 间消息前面加一句署名；链上只留正文。 */
function stripAgentPrefix(text: string): string {
  return text.replace(/^Agent .+? sent a message:\s*/u, '')
}

function firstLine(text: string, limit: number): string {
  const line = text.split('\n', 1)[0]?.trim() ?? ''
  return line.length <= limit ? line : `${line.slice(0, limit - 1)}…`
}

function truncate(text: string, limit: number): string {
  return text.length <= limit ? text : `${text.slice(0, limit - 1)}…`
}

function ticketIdOf(event: L2Event): string | undefined {
  return (event.payload as { ticketId?: string }).ticketId
}

/**
 * 本单相关的事件。
 *
 * `approval/decided` 与 `approval/discarded` 不带 ticketId（它们只有 approvalId），
 * 所以先收集本单的审批，再按 id 收编它们的结局——否则决定行永远缺一半。
 */
function selectTicketEvents(ledger: readonly L2Event[], ticketId: string): L2Event[] {
  const approvalIds = new Set<string>()
  for (const event of ledger) {
    if (event.type === 'approval/pending' && event.payload.ticketId === ticketId) {
      approvalIds.add(event.payload.approvalId)
    }
  }
  return ledger.filter(event => {
    if (event.type === 'approval/decided' || event.type === 'approval/discarded') {
      return approvalIds.has(event.payload.approvalId)
    }
    return ticketIdOf(event) === ticketId
  })
}

function orderedBySeq(events: readonly L2Event[]): L2Event[] {
  return [...events].sort((left, right) => left.seq - right.seq)
}
