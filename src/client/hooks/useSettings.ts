// src/client/hooks/useSettings.ts
//
// 设置页的数据来源：打开时拉一次完整视图，保存后手动刷新。
// 不轮询：模型目录的构建有成本，设置也不像工单那样随时变化。

import { useCallback, useEffect, useState } from 'react'
import type { SettingsView } from '../../shared/settings.ts'
import { errorMessage, fetchSettings } from '../lib/http.ts'

export interface SettingsState {
  view?: SettingsView
  /** 最近一次读取失败的可读原因；成功后清空。 */
  error?: string
  loading: boolean
  reload: () => Promise<void>
}

export function useSettings(): SettingsState {
  const [state, setState] = useState<{ view?: SettingsView; error?: string; loading: boolean }>({
    loading: true,
  })

  const reload = useCallback(async () => {
    try {
      const view = await fetchSettings()
      setState({ view, loading: false })
    } catch (error) {
      setState(previous => ({ view: previous.view, error: errorMessage(error), loading: false }))
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  return { ...state, reload }
}
