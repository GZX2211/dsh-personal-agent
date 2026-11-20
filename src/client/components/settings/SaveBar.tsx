// src/client/components/settings/SaveBar.tsx
//
// 三个编辑器共用的保存条：有改动才出现，保存中禁用，失败时把原因放在左侧。

import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ReactElement } from 'react'
import type { Translate } from '../../i18n.ts'

export interface SaveBarProps {
  t: Translate
  dirty: boolean
  busy: boolean
  /** 有字段不合法时禁止保存；错误由各字段就地显示。 */
  invalid?: boolean
  error?: string
  onSave: () => void
  onDiscard: () => void
}

export function SaveBar({
  t,
  dirty,
  busy,
  invalid = false,
  error,
  onSave,
  onDiscard,
}: SaveBarProps): ReactElement | null {
  if (!dirty && error === undefined) return null
  return (
    <div className="pa-settings__savebar">
      {error === undefined ? null : (
        <span className="pa-settings__error" role="alert">
          {error}
        </span>
      )}
      <Button variant="outline" size="sm" disabled={busy} onClick={onDiscard}>
        {t('settingsDiscard')}
      </Button>
      <Button variant="primary" size="sm" disabled={busy || invalid} onClick={onSave}>
        {busy ? t('settingsSaving') : t('settingsSave')}
      </Button>
    </div>
  )
}
