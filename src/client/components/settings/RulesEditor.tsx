// src/client/components/settings/RulesEditor.tsx
//
// 派单规则编辑器：每条规则一个开关、名称与说明；保存时整体替换规则集。
// 规则会进入 Router 的提示词，所以字数上限与后端契约共用同一组常量。

import { Button, Input, Switch } from '@deepseek-ai/dsh-client-ui-primitives'
import { useEffect, useState, type ReactElement } from 'react'
import { PROMPT_LIMITS, type DispatchRule, type SettingsView } from '../../../shared/settings.ts'
import type { Translate } from '../../i18n.ts'
import {
  newRuleId,
  ruleDraftError,
  type RuleDraftError,
} from '../../lib/settings.ts'
import { settingsErrorText } from './errors.ts'
import { SaveBar } from './SaveBar.tsx'
import type { SettingsActions } from './types.ts'

export interface RulesEditorProps {
  t: Translate
  view: SettingsView
  actions: SettingsActions
  onSaved: () => void
}

function ruleErrorText(t: Translate, error: RuleDraftError | undefined): string | undefined {
  switch (error) {
    case 'nameRequired':
      return t('settingsRuleNameRequired')
    case 'nameTooLong':
      return t('settingsRuleNameTooLong', { max: PROMPT_LIMITS.ruleName })
    case 'instructionRequired':
      return t('settingsRuleInstructionRequired')
    case 'instructionTooLong':
      return t('settingsRuleInstructionTooLong', { max: PROMPT_LIMITS.ruleInstruction })
    case 'duplicateId':
      return t('settingsRuleDuplicate')
    default:
      return undefined
  }
}

function sameRules(left: readonly DispatchRule[], right: readonly DispatchRule[]): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

export function RulesEditor({ t, view, actions, onSaved }: RulesEditorProps): ReactElement {
  const [rules, setRules] = useState<DispatchRule[]>(view.policy.rules)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  // 保存成功后容器会刷新视图；用修订号把草稿重置为刚保存的内容。
  useEffect(() => {
    setRules(view.policy.rules)
    setError(undefined)
  }, [view.revision])

  const dirty = !sameRules(rules, view.policy.rules)
  const invalid = rules.some(rule => ruleDraftError(rule, rules) !== undefined)

  const edit = (id: string, change: Partial<DispatchRule>): void => {
    setRules(current => current.map(rule => (rule.id === id ? { ...rule, ...change } : rule)))
  }

  const remove = (id: string): void => {
    setRules(current => current.filter(rule => rule.id !== id))
  }

  const add = (): void => {
    setRules(current => [
      ...current,
      { id: newRuleId(current), name: '', instruction: '', enabled: true },
    ])
  }

  const save = async (): Promise<void> => {
    setBusy(true)
    setError(undefined)
    try {
      await actions.savePolicy(
        rules.map(rule => ({
          ...rule,
          name: rule.name.trim(),
          instruction: rule.instruction.trim(),
        })),
        view.revision,
      )
      onSaved()
    } catch (failure) {
      setError(settingsErrorText(t, failure, t('settingsSaveFailed')))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="pa-settings__section">
      <div className="pa-settings__card">
        <div className="pa-settings__head">
          <span className="pa-settings__meta">
            {t('settingsPolicyVersion', { version: view.policy.version })}
          </span>
          <Button variant="ghost" size="sm" onClick={add}>
            {t('settingsRuleAdd')}
          </Button>
        </div>
        <p className="pa-settings__help">{t('settingsRulesIntro')}</p>

        {rules.length === 0 ? (
          <p className="pa-settings__empty">{t('settingsRulesEmpty')}</p>
        ) : (
          <div className="pa-settings__rules">
            {rules.map(rule => {
              const message = ruleErrorText(t, ruleDraftError(rule, rules))
              return (
                <div key={rule.id} className="pa-settings__rule">
                  <div className="pa-settings__rule-head">
                    <Switch
                      checked={rule.enabled}
                      label={rule.name.trim().length > 0 ? rule.name : t('settingsRuleUntitled')}
                      onChange={enabled => edit(rule.id, { enabled })}
                    />
                    <Input
                      className="pa-settings__rule-name"
                      value={rule.name}
                      placeholder={t('settingsRuleName')}
                      aria-label={t('settingsRuleName')}
                      onChange={event => edit(rule.id, { name: event.target.value })}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={t('settingsRuleRemove')}
                      onClick={() => remove(rule.id)}
                    >
                      ×
                    </Button>
                  </div>
                  <textarea
                    className="pa-settings__textarea"
                    rows={2}
                    value={rule.instruction}
                    placeholder={t('settingsRuleInstruction')}
                    aria-label={t('settingsRuleInstruction')}
                    onChange={event => edit(rule.id, { instruction: event.target.value })}
                  />
                  {message === undefined ? null : (
                    <p className="pa-settings__error" role="alert">
                      {message}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

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
          setError(undefined)
        }}
      />
    </div>
  )
}
