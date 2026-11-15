// src/client/views/Approvals.tsx
//
// 审批页：胶囊（待审批 / 已通过 / 全部）+ 搜索，列表用同一张卡片渲染；
// 提交决定后立即刷新，并按稳定错误码给出具体原因。

import { useState, type ReactElement } from 'react'
import type { ApprovalView } from '../../shared/approvals.ts'
import type { SnapshotResponse } from '../../shared/api.ts'
import type { ConsoleActions } from '../actions.ts'
import { ApprovalCard } from '../components/ApprovalCard.tsx'
import { FilterBar } from '../components/FilterBar.tsx'
import type { Translate } from '../i18n.ts'
import {
  buildDecision,
  decisionErrorKey,
  type ApprovalDraft,
} from '../lib/approvals.ts'
import { filterApprovals, matchesApprovalCapsule, type ApprovalCapsule } from '../lib/filter.ts'
import { ApiError, decideApproval } from '../lib/http.ts'

const CAPSULES: readonly ApprovalCapsule[] = ['pending', 'decided', 'all']

export interface ApprovalsProps {
  t: Translate
  language: string
  /** 右侧栏所在会话；文件预览用它授权读取。 */
  sessionId?: string
  snapshot?: SnapshotResponse
  /** 连接中断时的原因；非空即显示重试横幅。 */
  error?: string
  refresh: () => void
  actions: ConsoleActions
}

export function Approvals({
  t,
  language,
  sessionId,
  snapshot,
  error,
  refresh,
  actions,
}: ApprovalsProps): ReactElement {
  const [capsule, setCapsule] = useState<ApprovalCapsule>('pending')
  const [query, setQuery] = useState('')
  const [busyId, setBusyId] = useState<string>()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [notice, setNotice] = useState<string>()

  const approvals = snapshot?.approvals ?? []

  const visible = filterApprovals(approvals, capsule, query, { t, language })
  const capsuleHasItems = approvals.some(approval => matchesApprovalCapsule(approval, capsule))

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
    <>
      <FilterBar
        options={CAPSULES.map(id => ({ id, label: t(capsuleLabelKey(id)) }))}
        active={capsule}
        onSelect={id => setCapsule(id as ApprovalCapsule)}
        query={query}
        onQueryChange={setQuery}
        searchPlaceholder={t('searchPlaceholder')}
        help={{
          label: t('helpOpen'),
          title: t('helpTitle'),
          paragraphs: [t('helpBodyPending'), t('helpBodyDecided'), t('helpBodySearch')],
          closeLabel: t('helpClose'),
        }}
      />

      {error !== undefined ? (
        <div className="pa-banner" role="status">
          <span>{t('approvalConnectionLost')}</span>
          <button type="button" className="pa-banner__retry" onClick={() => refresh()}>
            {t('approvalRefresh')}
          </button>
        </div>
      ) : null}

      {notice !== undefined ? <p className="pa-notice">{notice}</p> : null}

      <div className="pa-list">
        {visible.length === 0 ? (
          <span className="pa-console__empty">{t(emptyKey(capsule, query, capsuleHasItems))}</span>
        ) : (
          visible.map(approval => (
            <ApprovalCard
              key={approval.id}
              t={t}
              language={language}
              sessionId={sessionId}
              approval={approval}
              actions={actions}
              busy={busyId === approval.id}
              error={errors[approval.id] === undefined || errors[approval.id] === '' ? undefined : errors[approval.id]}
              onSubmit={draft => {
                void submit(approval, draft)
              }}
            />
          ))
        )}
      </div>
    </>
  )
}

function capsuleLabelKey(capsule: ApprovalCapsule): 'approvalsFilterPending' | 'approvalsFilterDecided' | 'approvalsFilterAll' {
  switch (capsule) {
    case 'pending':
      return 'approvalsFilterPending'
    case 'decided':
      return 'approvalsFilterDecided'
    case 'all':
      return 'approvalsFilterAll'
  }
}

/** 空态先说清楚是「这一类还没有」还是「搜索没命中」。 */
function emptyKey(
  capsule: ApprovalCapsule,
  query: string,
  capsuleHasItems: boolean,
): 'approvalsEmptyPending' | 'approvalsEmptyDecided' | 'approvalsEmptyAll' | 'approvalsNoMatch' {
  if (capsuleHasItems && query.trim().length > 0) return 'approvalsNoMatch'
  switch (capsule) {
    case 'pending':
      return 'approvalsEmptyPending'
    case 'decided':
      return 'approvalsEmptyDecided'
    case 'all':
      return 'approvalsEmptyAll'
  }
}
