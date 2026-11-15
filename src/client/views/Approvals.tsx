// src/client/views/Approvals.tsx
//
// 审批页：三胶囊（待审批 / 已通过 / 全部）+ 搜索 + 卡片列表。
// 卡片同时只展开一张；已通过的卡片只读。过滤与搜索都是 lib/filter.ts 的纯函数。

import { useState, type ReactElement } from 'react'
import { ApprovalCard } from '../components/ApprovalCard.tsx'
import { FilterBar } from '../components/FilterBar.tsx'
import type { SnapshotHandle } from '../hooks/useSnapshot.ts'
import { ApiError, decideApproval } from '../lib/http.ts'
import { buildDecision, decisionErrorKey, type ApprovalDraft } from '../lib/approvals.ts'
import { filterApprovals, type ApprovalCapsule, type FilterContext } from '../lib/filter.ts'
import type { Dict, Translate } from '../i18n.ts'
import type { ApprovalView } from '../../shared/approvals.ts'

const CAPSULES: readonly { id: ApprovalCapsule; label: keyof Dict }[] = [
  { id: 'pending', label: 'approvalsFilterPending' },
  { id: 'decided', label: 'approvalsFilterDecided' },
  { id: 'all', label: 'approvalsFilterAll' },
]

export interface ApprovalsProps {
  t: Translate
  language: string
  data: SnapshotHandle
}

export function Approvals({ t, language, data }: ApprovalsProps): ReactElement {
  const [capsule, setCapsule] = useState<ApprovalCapsule>('pending')
  const [query, setQuery] = useState('')
  const [expandedId, setExpandedId] = useState<string>()
  const [busyId, setBusyId] = useState<string>()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [notice, setNotice] = useState<string>()

  const now = Date.now()
  const ctx: FilterContext = { t, language, now }
  const visible = filterApprovals(data.snapshot?.approvals ?? [], capsule, query, ctx)

  const submit = async (approval: ApprovalView, draft: ApprovalDraft): Promise<void> => {
    const decision = buildDecision(approval, draft)
    if (decision === undefined) return
    setBusyId(approval.id)
    setErrors(previous => ({ ...previous, [approval.id]: '' }))
    try {
      const result = await decideApproval(approval.id, decision)
      setNotice(t(result.transport === 'inline' ? 'approvalSubmittedInline' : 'approvalSubmittedFollowup'))
      data.refresh()
    } catch (failure) {
      const key = failure instanceof ApiError ? decisionErrorKey(failure.code) : 'decisionErrorUnknown'
      setErrors(previous => ({ ...previous, [approval.id]: t(key) }))
    } finally {
      setBusyId(undefined)
    }
  }

  const toggle = (id: string): void => {
    setExpandedId(previous => (previous === id ? undefined : id))
  }

  const emptyText = emptyMessage(capsule, query, t)

  return (
    <div className="pa-approvals">
      {data.error !== undefined ? (
        <div className="pa-approvals__banner" role="status">
          <span>{t('approvalConnectionLost')}</span>
          <button type="button" className="pa-approvals__retry" onClick={() => data.refresh()}>
            {t('approvalRefresh')}
          </button>
        </div>
      ) : null}

      {notice !== undefined ? <p className="pa-approvals__notice">{notice}</p> : null}

      <FilterBar
        segments={CAPSULES.map(item => ({ id: item.id, label: t(item.label) }))}
        active={capsule}
        onSelect={id => setCapsule(id as ApprovalCapsule)}
        query={query}
        onQueryChange={setQuery}
        placeholder={t('approvalSearchPlaceholder')}
      />

      {visible.length === 0 ? (
        <span className="pa-console__empty">{emptyText}</span>
      ) : (
        visible.map(approval => (
          <ApprovalCard
            key={approval.id}
            t={t}
            approval={approval}
            now={now}
            language={language}
            expanded={expandedId === approval.id}
            busy={busyId === approval.id}
            error={
              errors[approval.id] === undefined || errors[approval.id] === ''
                ? undefined
                : errors[approval.id]
            }
            onToggle={() => toggle(approval.id)}
            onSubmit={draft => {
              void submit(approval, draft)
            }}
          />
        ))
      )}
    </div>
  )
}

function emptyMessage(capsule: ApprovalCapsule, query: string, t: Translate): string {
  if (query.trim().length > 0) return t('approvalsNoMatch')
  switch (capsule) {
    case 'pending':
      return t('approvalsEmptyPending')
    case 'decided':
      return t('approvalsEmptyDecided')
    case 'all':
      return t('approvalsEmptyAll')
  }
}
