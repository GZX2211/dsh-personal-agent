// src/client/components/settings/RuleListEditor.tsx
//
// 一张受控的规则卡片：标题、版本、说明、可增删的规则列表。
// 派单规则与决策权限共用它，差异只在文案与传入的规则数组。

import { Button, Input, Switch } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ReactElement } from 'react'
import { PROMPT_LIMITS, type DispatchRule } from '../../../shared/settings.ts'
import type { Translate } from '../../i18n.ts'
import { newRuleId, ruleDraftError, type RuleDraftError } from '../../lib/settings.ts'

export interface RuleListEditorProps {
  t: Translate
  title: string
  /** 已插值的版本行，例如「策略版本 4f53cda1」。 */
  versionText: string
  intro: string
  emptyText: string
  addLabel: string
  untitledLabel: string
  rules: readonly DispatchRule[]
  onChange: (rules: DispatchRule[]) => void
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

export function RuleListEditor({
  t,
  title,
  versionText,
  intro,
  emptyText,
  addLabel,
  untitledLabel,
  rules,
  onChange,
}: RuleListEditorProps): ReactElement {
  const edit = (id: string, change: Partial<DispatchRule>): void => {
    onChange(rules.map(rule => (rule.id === id ? { ...rule, ...change } : rule)))
  }

  const add = (): void => {
    onChange([...rules, { id: newRuleId(rules), name: '', instruction: '', enabled: true }])
  }

  return (
    <div className="pa-settings__card">
      <div className="pa-settings__head">
        <h3 className="pa-settings__title">{title}</h3>
        <span className="pa-settings__meta">{versionText}</span>
      </div>
      <div className="pa-settings__head">
        <p className="pa-settings__help">{intro}</p>
        <Button variant="ghost" size="sm" onClick={add}>
          {addLabel}
        </Button>
      </div>

      {rules.length === 0 ? (
        <p className="pa-settings__empty">{emptyText}</p>
      ) : (
        <div className="pa-settings__rules">
          {rules.map(rule => {
            const message = ruleErrorText(t, ruleDraftError(rule, rules))
            return (
              <div key={rule.id} className="pa-settings__rule">
                <div className="pa-settings__rule-head">
                  <Switch
                    checked={rule.enabled}
                    label={rule.name.trim().length > 0 ? rule.name : untitledLabel}
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
                    onClick={() => onChange(rules.filter(item => item.id !== rule.id))}
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
  )
}
