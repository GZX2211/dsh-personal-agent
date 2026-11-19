// src/client/hooks/useSignalQuery.ts
//
// 事件页的搜索数据：查询为空时不发请求（用快照那一段），非空时防抖检索全量账本。
// `revision` 由调用方用轮询快照的可见变化给出：新事实到达后搜索结果也要跟上。

import { useEffect, useState } from 'react'
import type { SignalQueryResponse } from '../../shared/api.ts'
import { errorMessage, querySignals } from '../lib/http.ts'

/** 输入停顿多久才发请求：既不让每个键触发一次，也不让人等。 */
const DEBOUNCE_MS = 250

export interface SignalQueryState {
  /** 最近一次搜索结果；查询为空或首次请求前为 undefined。 */
  result?: SignalQueryResponse
  loading: boolean
  error?: string
}

export function useSignalQuery(query: string, revision: string): SignalQueryState {
  const [state, setState] = useState<SignalQueryState>({ loading: false })
  const text = query.trim()

  useEffect(() => {
    if (text.length === 0) {
      setState({ loading: false })
      return
    }

    const controller = new AbortController()
    // 清掉上一轮的失败：新的输入就是新的尝试。
    setState(previous => ({ ...previous, loading: true, error: undefined }))
    const timer = setTimeout(() => {
      void querySignals({ q: text }, controller.signal)
        .then(result => {
          if (!controller.signal.aborted) setState({ result, loading: false })
        })
        .catch(error => {
          if (controller.signal.aborted) return
          setState(previous => ({ ...previous, loading: false, error: errorMessage(error) }))
        })
    }, DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [text, revision])

  return state
}
