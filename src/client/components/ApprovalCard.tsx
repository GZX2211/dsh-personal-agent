// src/client/components/ApprovalCard.tsx
//
// 一张待审批卡片：默认展开，给出选项、可填字段与备注，由容器负责提交。
// 已通过/作废的条目不在待审批列表里，所以这里只渲染待审批形态。

import { useState, type ReactElement } from 'react'
import type { ApprovalField, ApprovalView } from '../../shared/approvals.ts'
import type { Translate } from '../i18n.ts'
import { shortTicket, missingRequiredFields, type ApprovalDraft } from '../lib/approvals.ts'
import { formatTime, riskKey } from '../lib/format.ts'

export interface ApprovalCardProps {
  t: Translate
  approval: ApprovalView
  now: number
  language: string
  busy: boolean
  error?: string
  onSubmit: (draft: ApprovalDraft) => void
}

export function ApprovalCard({
  t,
  approval,
  now,
  language,
  busy,
  error,
  onSubmit,
}: ApprovalCardProps): ReactElement {
  const [expanded, setExpanded] = useState(true)
  const [optionIndex, setOptionIndex] = useState<number | undefined>(undefined)
  const [note, setNote] = useState('')
  const [fields, setFields] = useState<Record<string, string | boolean>>({})

  const missing = missingRequiredFields(approval, fields)
  const canSubmit = !busy && optionIndex !== undefined && missing.length === 0
  const canSkip = !busy && missing.length === 0

  return (
    <article className="pa-approval" data-risk={approval.risk ?? 'none'}>
      <button type="button" className="pa-approval__head" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
        <span className="pa-approval__title">{approval.title}</span>
        <span className="pa-approval__meta">
          {approval.risk !== undefined ? (
            <span className={`pa-approval__risk pa-approval__risk--${approval.risk}`}>
              {t('approvalRiskLabel')}·{t(riskKey(approval.risk))}
            </span>
          ) : null}
          <span>
            {t('approvalTicket')} #{shortTicket(approval.ticketId)}
          </span>
          <span>{formatTime(t, language, now, approval.createdAt)}</span>
        </span>
      </button>

      {expanded ? (
        <div className="pa-approval__body">
          <p className="pa-approval__question">{approval.question}</p>

          <div className="pa-approval__options" role="radiogroup" aria-label={t('approvalChooseOption')}>
            {approval.options.map((option, index) => (
              <label key={`${option.label}-${index}`} className="pa-approval__option">
                <input
                  type="radio"
                  name={`pa-option-${approval.id}`}
                  checked={optionIndex === index}
                  disabled={busy}
                  onChange={() => setOptionIndex(index)}
                />
                <span className="pa-approval__option-text">
                  <strong>{option.label}</strong>
                  <span className="pa-approval__option-desc">{option.description}</span>
                </span>
              </label>
            ))}
          </div>

          {approval.fields.length > 0 ? (
            <div className="pa-approval__fields">
              <div className="pa-approval__section-title">{t('approvalFieldsLabel')}</div>
              {approval.fields.map(field => (
                <FieldInput
                  key={field.key}
                  field={field}
                  value={fields[field.key]}
                  disabled={busy}
                  onChange={value => setFields(previous => ({ ...previous, [field.key]: value }))}
                />
              ))}
            </div>
          ) : null}

          <label className="pa-approval__note">
            <span className="pa-approval__section-title">{t('approvalNoteLabel')}</span>
            <textarea
              className="pa-approval__note-input"
              rows={2}
              value={note}
              placeholder={t('approvalNotePlaceholder')}
              disabled={busy}
              onChange={event => setNote(event.target.value)}
            />
          </label>

          {missing.length > 0 ? <p className="pa-approval__hint">{t('approvalRequiredHint')}</p> : null}
          {error !== undefined ? (
            <p className="pa-approval__error" role="alert">
              {error}
            </p>
          ) : null}

          <div className="pa-approval__actions">
            <button
              type="button"
              className="pa-approval__secondary"
              disabled={!canSkip}
              onClick={() => onSubmit({ note, fields })}
            >
              {t('approvalSkip')}
            </button>
            <button
              type="button"
              className="pa-approval__primary"
              disabled={!canSubmit}
              onClick={() => onSubmit({ optionIndex, note, fields })}
            >
              {busy ? t('approvalSubmitting') : t('approvalSubmit')}
            </button>
          </div>
        </div>
      ) : null}
    </article>
  )
}

interface FieldInputProps {
  field: ApprovalField
  value: string | boolean | undefined
  disabled: boolean
  onChange: (value: string | boolean) => void
}

function FieldInput({ field, value, disabled, onChange }: FieldInputProps): ReactElement {
  const label = (
    <span className="pa-approval__field-label">
      {field.label}
      {field.required === true ? ' *' : ''}
    </span>
  )

  if (field.type === 'boolean') {
    return (
      <label className="pa-approval__field pa-approval__field--boolean">
        <input
          type="checkbox"
          checked={value === true}
          disabled={disabled}
          onChange={event => onChange(event.target.checked)}
        />
        {label}
      </label>
    )
  }

  if (field.type === 'textarea') {
    return (
      <label className="pa-approval__field">
        {label}
        <textarea
          rows={2}
          value={typeof value === 'string' ? value : ''}
          disabled={disabled}
          onChange={event => onChange(event.target.value)}
        />
      </label>
    )
  }

  return (
    <label className="pa-approval__field">
      {label}
      <input
        type={field.type === 'number' ? 'number' : 'text'}
        value={typeof value === 'string' ? value : ''}
        disabled={disabled}
        onChange={event => onChange(event.target.value)}
      />
    </label>
  )
}
