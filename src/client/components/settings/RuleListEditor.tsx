// src/client/components/settings/RuleListEditor.tsx
//
// 一张受控的规则卡片：标题与添加入口固定在卡片顶部，规则默认折叠成一行，
// 展开后才出现名称、说明与删除动作。派单规则与决策权限共用它，差异只在
// 文案与传入的规则数组。

import {
  Button,
  IconChevronDownOutlineRegular,
  IconPlusOutlineRegular,
  IconTrashOutlineRegular,
  Input,
  Switch,
} from '@deepseek-ai/dsh-client-ui-primitives'
import { useEffect, useState, type ReactElement } from 'react'
import { PROMPT_LIMITS, type DispatchRule } from '../../../shared/settings.ts'
import type { Translate } from '../../i18n.ts'
import { newRuleId, ruleDraftError, type RuleDraftError } from '../../lib/settings.ts'

export interface RuleListEditorProps {
  t: Translate
  title: string
  intro: string
  emptyText: string
  addLabel: string
  removeLabel: string
  nameLabel: string
  instructionLabel: string
  untitledLabel: string
  rules: readonly DispatchRule[]
  onChange: (rules: DispatchRule[]) => void
}

function ruleErrorText(
  t: Translate,
  error: RuleDraftError | undefined,
  nameLabel: string,
  instructionLabel: string,
): string | undefined {
  switch (error) {
    case 'nameRequired':
      return t('settingsFieldNameRequired', { label: nameLabel })
    case 'nameTooLong':
      return t('settingsFieldNameTooLong', { label: nameLabel, max: PROMPT_LIMITS.ruleName })
    case 'instructionRequired':
      return t('settingsFieldInstructionRequired', { label: instructionLabel })
    case 'instructionTooLong':
      return t('settingsFieldInstructionTooLong', { label: instructionLabel, max: PROMPT_LIMITS.ruleInstruction })
    case 'duplicateId':
      return t('settingsRuleDuplicate')
    default:
      return undefined
  }
}

export function RuleListEditor({
  t,
  title,
  intro,
  emptyText,
  addLabel,
  removeLabel,
  nameLabel,
  instructionLabel,
  untitledLabel,
  rules,
  onChange,
}: RuleListEditorProps): ReactElement {
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(() => new Set())
  const [focusId, setFocusId] = useState<string>()

  // 删除或重新载入后，折叠状态里可能残留已经不存在的 id。
  useEffect(() => {
    setOpenIds(current => {
      const alive = new Set(rules.map(rule => rule.id))
      if ([...current].every(id => alive.has(id))) return current
      return new Set([...current].filter(id => alive.has(id)))
    })
  }, [rules])

  const edit = (id: string, change: Partial<DispatchRule>): void => {
    onChange(rules.map(rule => (rule.id === id ? { ...rule, ...change } : rule)))
  }

  const close = (id: string): void => {
    setOpenIds(current => {
      if (!current.has(id)) return current
      const next = new Set(current)
      next.delete(id)
      return next
    })
  }

  const toggle = (id: string): void => {
    setOpenIds(current => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const remove = (id: string): void => {
    onChange(rules.filter(rule => rule.id !== id))
    close(id)
  }

  const add = (): void => {
    if (rules.length >= PROMPT_LIMITS.rules) return
    const rule: DispatchRule = { id: newRuleId(rules), name: '', instruction: '', enabled: true }
    onChange([...rules, rule])
    setOpenIds(current => new Set(current).add(rule.id))
    setFocusId(rule.id)
  }

  const full = rules.length >= PROMPT_LIMITS.rules

  return (
    <div className="pa-settings__card pa-rules">
      <div className="pa-rules__head">
        <div className="pa-rules__heading">
          <h3 className="pa-settings__title">{title}</h3>
          {rules.length === 0 ? null : <span className="pa-rules__count">{rules.length}</span>}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="pa-rules__add"
          icon={<IconPlusOutlineRegular />}
          onClick={add}
          disabled={full}
          {...(full ? { title: t('settingsRuleLimit', { max: PROMPT_LIMITS.rules }) } : {})}
        >
          {addLabel}
        </Button>
      </div>
      <p className="pa-settings__help">{intro}</p>

      {rules.length === 0 ? (
        <p className="pa-rules__empty">{emptyText}</p>
      ) : (
        <div className="pa-rules__list">
          {rules.map(rule => {
            const open = openIds.has(rule.id)
            const message = ruleErrorText(t, ruleDraftError(rule, rules), nameLabel, instructionLabel)
            const name = rule.name.trim()
            const instruction = rule.instruction.trim()
            const bodyId = `pa-rule-body-${rule.id}`
            return (
              <div
                key={rule.id}
                className="pa-rule"
                data-open={open || undefined}
                data-disabled={!rule.enabled || undefined}
                data-invalid={message !== undefined || undefined}
              >
                <div className="pa-rule__header">
                  <button
                    type="button"
                    className="pa-rule__toggle"
                    aria-expanded={open}
                    aria-controls={open ? bodyId : undefined}
                    aria-label={`${name.length > 0 ? name : untitledLabel} · ${t(
                      open ? 'settingsRuleCollapse' : 'settingsRuleExpand',
                    )}`}
                    onClick={() => toggle(rule.id)}
                  >
                    <span className="pa-rule__dot" data-enabled={rule.enabled} aria-hidden="true" />
                    <span className="pa-rule__name" data-empty={name.length === 0 || undefined}>
                      {name.length > 0 ? name : untitledLabel}
                    </span>
                    <span
                      className="pa-rule__preview"
                      data-error={message !== undefined || undefined}
                      data-empty={(message === undefined && instruction.length === 0) || undefined}
                    >
                      {message ?? (instruction.length > 0 ? instruction : t('settingsRuleEmptyHint'))}
                    </span>
                    <IconChevronDownOutlineRegular className="pa-rule__chevron" aria-hidden="true" />
                  </button>
                  <Switch
                    checked={rule.enabled}
                    label={name.length > 0 ? name : untitledLabel}
                    className="pa-rule__switch"
                    onChange={enabled => edit(rule.id, { enabled })}
                  />
                </div>

                {open ? (
                  <div className="pa-rule__body" id={bodyId}>
                    <label className="pa-settings__field">
                      <span className="pa-settings__label">{nameLabel}</span>
                      <Input
                        className="pa-rule__input"
                        value={rule.name}
                        placeholder={nameLabel}
                        autoFocus={rule.id === focusId}
                        onChange={event => edit(rule.id, { name: event.target.value })}
                      />
                    </label>
                    <label className="pa-settings__field">
                      <span className="pa-settings__label">{instructionLabel}</span>
                      <textarea
                        className="pa-settings__textarea pa-rule__textarea"
                        rows={3}
                        value={rule.instruction}
                        placeholder={instructionLabel}
                        onChange={event => edit(rule.id, { instruction: event.target.value })}
                      />
                    </label>
                    {message === undefined ? null : (
                      <p className="pa-settings__error" role="alert">
                        {message}
                      </p>
                    )}
                    <div className="pa-rule__footer">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="pa-rule__remove"
                        icon={<IconTrashOutlineRegular />}
                        onClick={() => remove(rule.id)}
                      >
                        {removeLabel}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
