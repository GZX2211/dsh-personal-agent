// src/client/components/ApprovalCard.tsx
//
// 一张待审批卡片：默认展开，给出选项与「输入你的答案」，由容器负责提交。
// 已通过/作废的条目不在待审批列表里，所以这里只渲染待审批形态。

import { useState, type ReactElement } from 'react'
import type { ApprovalView } from '../../shared/approvals.ts'
import type { Translate } from '../i18n.ts'
import { shortTicket, type ApprovalDraft } from '../lib/approvals.ts'
import { formatTimestamp, riskKey } from '../lib/format.ts'

export interface ApprovalCardProps {
  t: Translate
  approval: ApprovalView
  language: string
  busy: boolean
  error?: string
  onSubmit: (draft: ApprovalDraft) => void
}

export function ApprovalCard({
  t,
  approval,
  language,
  busy,
  error,
  onSubmit,
}: ApprovalCardProps): ReactElement {
  const [expanded, setExpanded] = useState(true)
  const [optionIndex, setOptionIndex] = useState<number | undefined>(undefined)
  const [note, setNote] = useState('')

  const canSubmit = !busy

  return (
    <article className="pa-approval" data-risk={approval.risk ?? 'none'}>
      <button type="button" className="pa-approval__head" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
        <span className="pa-approval__title">{approval.question}</span>
        <span className="pa-approval__meta">
          {approval.risk !== undefined ? (
            <span className={`pa-approval__risk pa-approval__risk--${approval.risk}`}>
              {t('approvalRiskLabel')}·{t(riskKey(approval.risk))}
            </span>
          ) : null}
          <span>
            {t('approvalTicket')} #{shortTicket(approval.ticketId)}
          </span>
          <span>{formatTimestamp(language, approval.createdAt)}</span>
        </span>
      </button>

      {expanded ? (
        <div className="pa-approval__body">
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

          <label className="pa-approval__note">
            <textarea
              className="pa-approval__note-input"
              rows={2}
              value={note}
              placeholder={t('approvalAnswerPlaceholder')}
              disabled={busy}
              onChange={event => setNote(event.target.value)}
            />
          </label>

          {error !== undefined ? (
            <p className="pa-approval__error" role="alert">
              {error}
            </p>
          ) : null}

          <div className="pa-approval__actions">
            <button
              type="button"
              className="pa-approval__secondary"
              disabled={!canSubmit}
              onClick={() => onSubmit({ note })}
            >
              {t('approvalSkip')}
            </button>
            <button
              type="button"
              className="pa-approval__primary"
              disabled={!canSubmit}
              onClick={() => onSubmit({ optionIndex, note })}
            >
              {busy ? t('approvalSubmitting') : t('approvalSubmit')}
            </button>
          </div>
        </div>
      ) : null}
    </article>
  )
}
