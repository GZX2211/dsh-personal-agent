// src/client/hooks/useSnapshot.ts
//
// 面板的数据来源：可见时轮询 /snapshot，失败退避；提交决定后可立即刷新。
// 轮询是生命周期适配层，组件只消费它吐出的状态。

import { useEffect, useRef, useState } from 'react'
import type { SnapshotResponse } from '../../shared/api.ts'
import { ApiError, fetchSnapshot } from '../lib/http.ts'

/** 面板可见时的刷新间隔（方案 §9.3）。 */
const POLL_MS = 2_000
/** 失败后的退避间隔。 */
const BACKOFF_MS = 10_000

export interface SnapshotState {
  snapshot?: SnapshotResponse
  /** 最近一次失败的可读原因；成功后清空。 */
  error?: string
}

export interface SnapshotHandle extends SnapshotState {
  /** 立即拉一次（提交决定后使用），并把轮询间隔复位。 */
  refresh: () => void
}

export function useSnapshot(): SnapshotHandle {
  const [state, setState] = useState<SnapshotState>({})
  const refreshRef = useRef<() => void>(() => undefined)

  useEffect(() => {
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
        const snapshot = await fetchSnapshot()
        if (disposed) return
        delay = POLL_MS
        setState({ snapshot })
      } catch (error) {
        if (disposed) return
        delay = BACKOFF_MS
        setState(previous => ({ ...previous, error: describe(error) }))
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
  }, [])

  return { ...state, refresh: () => refreshRef.current() }
}

function describe(error: unknown): string {
  if (error instanceof ApiError) return `${error.code}: ${error.message}`
  return error instanceof Error ? error.message : String(error)
}
