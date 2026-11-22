// src/client/hooks/useTicketDetail.ts
//
// 工单详情的生命周期：拉取、可见时轮询、失败退避、结束即停。
// 已结束的工单几乎不再变化；继续轮询只会让侧栏一直发请求。404 交给页面回列表。

import { useEffect, useRef, useState } from 'react'
import { ERROR_CODES } from '../../shared/api.ts'
import type { TicketDetailResponse } from '../../shared/ticket-detail.ts'
import { ApiError, fetchTicketDetail } from '../lib/http.ts'

/** 排队/运行中的刷新间隔。 */
const POLL_MS = 2_000
/** 失败后的退避间隔。 */
const BACKOFF_MS = 10_000

export interface TicketDetailState {
  detail?: TicketDetailResponse
  /** 最近一次失败的可读原因；成功后清空。 */
  error?: string
  loading: boolean
  notFound: boolean
}

export interface TicketDetailHandle extends TicketDetailState {
  /** 立即拉一次，并把轮询间隔复位。 */
  refresh: () => void
}

export interface UseTicketDetailOptions {
  /** 工单不存在时调用一次；页面据此回列表。 */
  onNotFound?: () => void
}

export function useTicketDetail(ticketId: string, options: UseTicketDetailOptions = {}): TicketDetailHandle {
  const [state, setState] = useState<TicketDetailState>({ loading: true, notFound: false })
  const refreshRef = useRef<() => void>(() => undefined)
  const onNotFoundRef = useRef(options.onNotFound)
  onNotFoundRef.current = options.onNotFound

  useEffect(() => {
    let disposed = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let delay = POLL_MS
    let reportedMissing = false
    setState({ loading: true, notFound: false })

    const schedule = (ms: number): void => {
      if (disposed) return
      timer = setTimeout(() => void run(), ms)
    }

    const run = async (): Promise<void> => {
      if (disposed) return
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        schedule(POLL_MS)
        return
      }
      try {
        const detail = await fetchTicketDetail(ticketId)
        if (disposed) return
        delay = POLL_MS
        setState({ detail, loading: false, notFound: false })
        // 结束态停止轮询；如果之后需要看最新状态，重新进入详情即可。
        if (detail.ticket.stage === 'ended') return
      } catch (error) {
        if (disposed) return
        if (error instanceof ApiError && error.code === ERROR_CODES.ticketNotFound) {
          setState({ loading: false, notFound: true })
          if (!reportedMissing) {
            reportedMissing = true
            onNotFoundRef.current?.()
          }
          return
        }
        delay = BACKOFF_MS
        setState(previous => ({ ...previous, loading: false, error: describe(error) }))
      }
      schedule(delay)
    }

    refreshRef.current = () => {
      if (disposed) return
      if (timer !== undefined) clearTimeout(timer)
      delay = POLL_MS
      void run()
    }

    void run()

    const onVisibilityChange = (): void => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') refreshRef.current()
    }
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      disposed = true
      if (timer !== undefined) clearTimeout(timer)
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [ticketId])

  return { ...state, refresh: () => refreshRef.current() }
}

function describe(error: unknown): string {
  if (error instanceof ApiError) return `${error.code}: ${error.message}`
  return error instanceof Error ? error.message : String(error)
}
