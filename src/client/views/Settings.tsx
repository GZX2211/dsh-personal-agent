// src/client/views/Settings.tsx
//
// 设置页容器：读取设置视图、注入保存动作、统一显示保存提示。
// 三段编辑器只依赖注入的动作面，不直接发请求。

import { Toast, writeClipboard } from '@deepseek-ai/dsh-client-ui-primitives'
import { useState, type ReactElement } from 'react'
import type { DispatchRule, ExecutorSettings, PromptTexts } from '../../shared/settings.ts'
import { SettingsBody } from '../components/settings/SettingsBody.tsx'
import type { SettingsActions } from '../components/settings/types.ts'
import { useSettings } from '../hooks/useSettings.ts'
import type { Translate } from '../i18n.ts'
import {
  fetchPromptRevision,
  saveExecutor as postExecutor,
  savePolicy as postPolicy,
  savePrompts as postPrompts,
} from '../lib/http.ts'

export interface SettingsProps {
  t: Translate
  language: string
}

export function Settings({ t, language }: SettingsProps): ReactElement {
  const { view, error, loading, reload } = useSettings()
  const [toast, setToast] = useState<{ seq: number; text: string }>()

  const notice = (text: string): void => setToast({ seq: Date.now(), text })

  const actions: SettingsActions = {
    savePolicy: async (rules: readonly DispatchRule[], permissions: readonly DispatchRule[], revision: number) => {
      await postPolicy({ rules: [...rules], permissions: [...permissions], revision })
      await reload()
    },
    saveExecutor: async (executor: ExecutorSettings, revision: number) => {
      await postExecutor({ executor, revision })
      await reload()
    },
    savePrompts: async (texts: PromptTexts, baseRevision: number) => {
      await postPrompts({ texts, baseRevision })
      await reload()
    },
    loadPromptRevision: revision => fetchPromptRevision(revision),
    copyText: text => writeClipboard(text),
    refresh: reload,
  }

  if (loading && view === undefined) {
    return <p className="pa-console__empty">{t('settingsLoading')}</p>
  }

  if (view === undefined) {
    return (
      <div className="pa-settings">
        <div className="pa-banner" role="status">
          <span>{t('settingsLoadFailed')}</span>
          <button type="button" className="pa-banner__retry" onClick={() => void reload()}>
            {t('settingsRetry')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="pa-settings">
      {error === undefined ? null : (
        <div className="pa-banner" role="status">
          <span>{t('settingsLoadFailed')}</span>
          <button type="button" className="pa-banner__retry" onClick={() => void reload()}>
            {t('settingsRetry')}
          </button>
        </div>
      )}
      <SettingsBody
        t={t}
        language={language}
        view={view}
        actions={actions}
        onSaved={() => notice(t('settingsSaved'))}
        onNotice={notice}
      />
      {toast === undefined ? null : (
        <Toast key={toast.seq} text={toast.text} onDone={() => setToast(undefined)} />
      )}
    </div>
  )
}
