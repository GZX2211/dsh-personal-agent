// src/client/components/ApprovalCard.tsx
//
// 一张审批卡片：折叠态只给发起者、关联工单、时间与一句话预览，展开态给出选项、
// 可填字段与备注。已通过的卡片是只读态：显示决定内容与时间，不再提供提交。
// 展开与否和「同时只展开一张」由容器控制；这里只按 `expanded` 渲染。

import { useState, type ReactElement } from 'react'
import type { ApprovalField, ApprovalView } from '../../shared/approvals.ts'
import type { Translate } from '../i18n.ts'
import { shortTicket, missingRequiredFields, type ApprovalDraft } from '../lib/approvals.ts'
import { formatTime, riskKey } from '../lib/format.ts'
import { shortSession } from '../lib/tickets.ts'

/** 折叠态的题干预览上限：一行能放下的量级。 */
const PREVIEW_LIMIT = 80

export interface ApprovalCardProps {
  t: Translate
  approval: ApprovalView
  now: number
  language: string
  expanded: boolean
  busy: boolean
  error?: string
  onSubmit: (draft: ApprovalDraft) => void
  onToggle: () => void
}

export function ApprovalCard({
  t,
  approval,
  now,
  language,
  expanded,
  busy,
  error,
  onSubmit,
  onToggle,
}: ApprovalCardProps): ReactElement {
  const [optionIndex, setOptionIndex] = useState<number | undefined>(undefined)
  const [note, setNote] = useState('')
  const [fields, setFields] = useState<Record<string, string | boolean>>({})

  const readOnly = approval.decidedAt !== undefined
  const missing = missingRequiredFields(approval, fields)
  const canSubmit = !busy && optionIndex !== undefined && missing.length === 0
  const canSkip = !busy && missing.length === 0
  const preview = flatten(approval.question)

  return (
    <article className="pa-approval" data-readonly={readOnly || undefined} data-risk={approval.risk ?? 'none'}>
      <button
        type="button"
        className="pa-approval__head"
        aria-expanded={expanded}
        onClick={onToggle}
      >
        <span className="pa-approval__headline">
          <span className="pa-approval__title">{approval.title}</span>
          {readOnly ? (
            <span className="pa-approval__state">
              {t(approval.decision?.kind === 'skipped' ? 'approvalSkippedTitle' : 'approvalDecidedTitle')}
            </span>
          ) : null}
          <span className="pa-approval__chevron" aria-hidden="true" data-expanded={expanded || undefined} />
        </span>
        <span className="pa-approval__meta">
          <span>
            {t('approvalRequester')} · {t('approvalRequesterWorker')} {shortSession(approval.requestedBySessionId)}
          </span>
          <span>
            {t('approvalTicket')} #{shortTicket(approval.ticketId)}
          </span>
          {approval.risk !== undefined ? (
            <span className={`pa-approval__risk pa-approval__risk--${approval.risk}`}>
              {t('approvalRiskLabel')}·{t(riskKey(approval.risk))}
            </span>
          ) : null}
          <span>{formatTime(t, language, now, approval.createdAt)}</span>
        </span>
        {expanded ? null : <span className="pa-approval__preview">{preview}</span>}
      </button>

      {expanded ? (
        <div className="pa-approval__body">
          <p className="pa-approval__question">{approval.question}</p>

          {readOnly ? (
            <div className="pa-approval__decision">
              <div className="pa-approval__section-title">{t('approvalDecisionLabel')}</div>
              <p className="pa-approval__decision-value">
                {approval.decision?.kind === 'skipped'
                  ? t('approvalSkippedTitle')
                  : (approval.decision?.label ?? t('approvalDecidedTitle'))}
              </p>
              {approval.decision?.note !== undefined && approval.decision.note.length > 0 ? (
                <p className="pa-approval__decision-note">{approval.decision.note}</p>
              ) : null}
              <p className="pa-approval__decision-time">
                {formatTime(t, language, now, approval.decidedAt ?? approval.createdAt)}
              </p>
            </div>
          ) : (
            <>
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
            </>
          )}
        </div>
      ) : null}
    </article>
  )
}

function flatten(text: string): string {
  const oneLine = text.replace(/\s+/g, ' ').trim()
  return oneLine.length > PREVIEW_LIMIT ? `${oneLine.slice(0, PREVIEW_LIMIT)}…` : oneLine
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
