// src/client/views/Approvals.tsx
//
// 审批页（最小版）：轮询快照，列出待审批卡片；提交后立即刷新并显示结果。
// 「已通过/全部」胶囊与搜索留到 P3 后续。

import { useState, type ReactElement } from 'react'
import { ApprovalCard } from '../components/ApprovalCard.tsx'
import { useSnapshot } from '../hooks/useSnapshot.ts'
import { ApiError, decideApproval } from '../lib/http.ts'
import { buildDecision, decisionErrorKey, type ApprovalDraft } from '../lib/approvals.ts'
import type { Translate } from '../i18n.ts'
import type { ApprovalView } from '../../shared/approvals.ts'

export interface ApprovalsProps {
  t: Translate
  language: string
}

export function Approvals({ t, language }: ApprovalsProps): ReactElement {
  const { snapshot, error, refresh } = useSnapshot()
  const [busyId, setBusyId] = useState<string>()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [notice, setNotice] = useState<string>()

  const pending = (snapshot?.approvals ?? []).filter(approval => approval.decidedAt === undefined)
  const now = Date.now()

  const submit = async (approval: ApprovalView, draft: ApprovalDraft): Promise<void> => {
    const decision = buildDecision(approval, draft)
    if (decision === undefined) return
    setBusyId(approval.id)
    setErrors(previous => ({ ...previous, [approval.id]: '' }))
    try {
      const result = await decideApproval(approval.id, decision)
      setNotice(t(result.transport === 'inline' ? 'approvalSubmittedInline' : 'approvalSubmittedFollowup'))
      refresh()
    } catch (failure) {
      const key = failure instanceof ApiError ? decisionErrorKey(failure.code) : 'decisionErrorUnknown'
      setErrors(previous => ({ ...previous, [approval.id]: t(key) }))
    } finally {
      setBusyId(undefined)
    }
  }

  return (
    <div className="pa-approvals">
      {error !== undefined ? (
        <div className="pa-approvals__banner" role="status">
          <span>{t('approvalConnectionLost')}</span>
          <button type="button" className="pa-approvals__retry" onClick={() => refresh()}>
            {t('approvalRefresh')}
          </button>
        </div>
      ) : null}

      {notice !== undefined ? <p className="pa-approvals__notice">{notice}</p> : null}

      {pending.length === 0 ? (
        <span className="pa-console__empty">{t('approvalsEmptyPending')}</span>
      ) : (
        pending.map(approval => (
          <ApprovalCard
            key={approval.id}
            t={t}
            approval={approval}
            now={now}
            language={language}
            busy={busyId === approval.id}
            error={errors[approval.id] === undefined || errors[approval.id] === '' ? undefined : errors[approval.id]}
            onSubmit={draft => {
              void submit(approval, draft)
            }}
          />
        ))
      )}
    </div>
  )
}
