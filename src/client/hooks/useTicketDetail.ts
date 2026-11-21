// src/client/hooks/useTicketDetail.ts
//
// 详情页的数据来源：按 ticketId 轮询 /tickets/:id，失败退避，页面隐藏时暂停。
// 失败时保留上一次的详情：一次网络抖动不该让整页变空。

import { useEffect, useState } from 'react'
import type { TicketDetailResponse } from '../../shared/ticket-detail.ts'
import { ApiError, errorMessage, fetchTicketDetail } from '../lib/http.ts'

/** 与总控台其余页一致：可见时 2 秒一次。 */
const POLL_MS = 2_000
/** 失败后的退避间隔。 */
const BACKOFF_MS = 10_000

export interface TicketDetailState {
  detail?: TicketDetailResponse
  /** 最近一次失败的可读原因；成功后清空。 */
  error?: string
  /** 失败的稳定错误码：页面据此区分「工单不存在」与一般失败。 */
  errorCode?: string
  loading: boolean
}

export function useTicketDetail(ticketId: string | undefined): TicketDetailState {
  const [state, setState] = useState<TicketDetailState>({ loading: true })

  useEffect(() => {
    if (ticketId === undefined) {
      setState({ loading: false })
      return
    }
    let disposed = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let delay = POLL_MS

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
        setState({ detail, loading: false })
      } catch (error) {
        if (disposed) return
        delay = BACKOFF_MS
        setState(previous => ({
          detail: previous.detail,
          loading: false,
          error: errorMessage(error),
          errorCode: error instanceof ApiError ? error.code : 'unknown',
        }))
      }
      schedule(delay)
    }

    setState({ loading: true })
    void run()
    return () => {
      disposed = true
      if (timer !== undefined) clearTimeout(timer)
    }
  }, [ticketId])

  return state
}
