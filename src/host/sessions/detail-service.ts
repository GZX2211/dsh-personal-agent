// src/host/sessions/detail-service.ts
//
// 工单详情的装配：账本 + 会话窗口 → 详情视图，带一层按签名失效的缓存。
//
// 缓存保护的是 2 秒轮询：一次详情要读好几个会话日志，不能每次都重读。签名只取
// 「账本长度 + 工单的 updatedAt」——这两样变了，页面上的链就可能变了。

import type { SessionId } from '@deepseek-ai/dsh-session'
import type { TicketDetailResponse } from '../../shared/ticket-detail.ts'
import type { TicketView } from '../../shared/tickets.ts'
import type { HostContext } from '../context.ts'
import { deriveTicketDetail, type DetailSessionInput } from '../projector/ticket-detail.ts'
import type { EventStore } from '../store/event-store.ts'
import { readDetailSessions } from './detail-sessions.ts'

/** 运行中的工单变化快，缓存只挡一次轮询；已结束的工单几乎不会再变。 */
const RUNNING_TTL_MS = 2000
const ENDED_TTL_MS = 60_000

export interface TicketDetailServiceOptions {
  ctx: HostContext
  store: EventStore
  /** 注入时钟，便于测试缓存时效。 */
  now?: () => number
  log?: (message: string) => void
}

export interface TicketDetailService {
  /** 找不到这张工单时返回 undefined：路由据此回 404。 */
  detail(ticketId: string): Promise<TicketDetailResponse | undefined>
}

interface CacheEntry {
  signature: string
  at: number
  detail: TicketDetailResponse
}

export function createTicketDetailService(options: TicketDetailServiceOptions): TicketDetailService {
  const now = options.now ?? Date.now
  const cache = new Map<string, CacheEntry>()

  return {
    async detail(ticketId) {
      const ticket = options.store.projection().tickets.find(item => item.id === ticketId)
      if (ticket === undefined) return undefined

      const signature = `${options.store.events().length}:${ticket.updatedAt}`
      const cached = cache.get(ticketId)
      if (cached !== undefined && cached.signature === signature) {
        const ttl = ticket.stage === 'ended' ? ENDED_TTL_MS : RUNNING_TTL_MS
        if (now() - cached.at < ttl) return cached.detail
      }

      const detail = await derive(options, ticket, now)
      cache.set(ticketId, { signature, at: now(), detail })
      return detail
    },
  }
}

async function derive(
  options: TicketDetailServiceOptions,
  ticket: TicketView,
  now: () => number,
): Promise<TicketDetailResponse> {
  const at = now()
  const start = ticket.dispatchedAt ?? ticket.createdAt
  const end = ticket.endedAt ?? at
  let sessions: Map<string, DetailSessionInput> = new Map()
  if (ticket.workerSessionId !== undefined) {
    try {
      sessions = await readDetailSessions(options.ctx, ticket.workerSessionId as SessionId, {
        start,
        end,
      })
    } catch (error) {
      // 读会话是 best-effort：账本事实照样要能画出来。
      options.log?.(`ticket detail sessions unavailable for ${ticket.id}: ${describe(error)}`)
    }
  }
  return deriveTicketDetail({
    ticket,
    ledger: options.store.events(),
    sessions,
    now: at,
  })
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
