// src/client/components/settings/PolicyEditor.tsx
//
// 「策略」页：两张同构的规则卡片放在一起，一个保存条同时提交。
//
// 派单规则只进 Router 的提示词，决策权限只进 Worker 的提示词；两者结构相同，
// 但各自独立校验、独立显示版本。

import { useEffect, useState, type ReactElement } from 'react'
import type { DispatchRule, SettingsView } from '../../../shared/settings.ts'
import type { Translate } from '../../i18n.ts'
import { isSameRules, ruleDraftError } from '../../lib/settings.ts'
import { settingsErrorText } from './errors.ts'
import { RuleListEditor } from './RuleListEditor.tsx'
import { SaveBar } from './SaveBar.tsx'
import type { SettingsActions } from './types.ts'

export interface PolicyEditorProps {
  t: Translate
  view: SettingsView
  actions: SettingsActions
  onSaved: () => void
}

export function PolicyEditor({ t, view, actions, onSaved }: PolicyEditorProps): ReactElement {
  const [rules, setRules] = useState<DispatchRule[]>(view.policy.rules)
  const [permissions, setPermissions] = useState<DispatchRule[]>(view.policy.permissions)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  // 保存成功后容器刷新视图；用修订号把两组草稿重置为刚保存的内容。
  useEffect(() => {
    setRules(view.policy.rules)
    setPermissions(view.policy.permissions)
    setError(undefined)
  }, [view.revision])

  const dirty =
    !isSameRules(rules, view.policy.rules) || !isSameRules(permissions, view.policy.permissions)
  const invalid =
    rules.some(rule => ruleDraftError(rule, rules) !== undefined) ||
    permissions.some(rule => ruleDraftError(rule, permissions) !== undefined)

  const trim = (list: readonly DispatchRule[]): DispatchRule[] =>
    list.map(rule => ({ ...rule, name: rule.name.trim(), instruction: rule.instruction.trim() }))

  const save = async (): Promise<void> => {
    setBusy(true)
    setError(undefined)
    try {
      await actions.savePolicy(trim(rules), trim(permissions), view.revision)
      onSaved()
    } catch (failure) {
      setError(settingsErrorText(t, failure, t('settingsSaveFailed')))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="pa-settings__section">
      <RuleListEditor
        t={t}
        title={t('settingsRulesTab')}
        versionText={t('settingsPolicyVersion', { version: view.policy.version })}
        intro={t('settingsRulesIntro')}
        emptyText={t('settingsRulesEmpty')}
        addLabel={t('settingsRuleAdd')}
        untitledLabel={t('settingsRuleUntitled')}
        rules={rules}
        onChange={setRules}
      />
      <RuleListEditor
        t={t}
        title={t('settingsPermissionsTitle')}
        versionText={t('settingsPermissionVersion', { version: view.policy.permissionVersion })}
        intro={t('settingsPermissionsIntro')}
        emptyText={t('settingsPermissionsEmpty')}
        addLabel={t('settingsPermissionAdd')}
        untitledLabel={t('settingsPermissionUntitled')}
        rules={permissions}
        onChange={setPermissions}
      />

      <SaveBar
        t={t}
        dirty={dirty}
        busy={busy}
        invalid={invalid}
        {...(error === undefined ? {} : { error })}
        onSave={() => {
          void save()
        }}
        onDiscard={() => {
          setRules(view.policy.rules)
          setPermissions(view.policy.permissions)
          setError(undefined)
        }}
      />
    </div>
  )
}
