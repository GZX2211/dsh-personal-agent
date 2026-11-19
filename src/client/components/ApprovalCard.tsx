// src/client/components/ApprovalCard.tsx
//
// 审批列表行：三行排版——会话标题 / 题干 / 跳转会话 + 时间。标题不跳转，
// 工单号已从会话标题剥离；悬停看全文只属于第二行题干。
//
// 展开后是详情面板，保留原卡片的全部字段：完整题干、选项、回答、附件、
// 风险、分页与动作。状态由决定派生：待审批 / 已通过 / 已跳过。

import { Button, IconLinkOutlineRegular, Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import { useState, type ReactElement } from 'react'
import type { ApprovalView } from '../../shared/approvals.ts'
import type { ConsoleActions } from '../actions.ts'
import type { Translate } from '../i18n.ts'
import { shortSession, type ApprovalDraft } from '../lib/approvals.ts'
import { formatTimestamp, riskKey } from '../lib/format.ts'
import { stripTicketSuffix } from '../lib/sessions.ts'
import { CardAnswerField, CardAnswerText } from './card/CardAnswer.tsx'
import { CardAttachment } from './card/CardAttachment.tsx'
import { CardFooter } from './card/CardFooter.tsx'
import { CardOption } from './card/CardOption.tsx'
import { ListRow, type ListRowStatus } from './ListRow.tsx'
import { riskTagTone } from './status.ts'

export interface ApprovalCardProps {
  t: Translate
  language: string
  /** 右侧栏所在会话；文件预览用它授权读取。 */
  sessionId?: string
  approval: ApprovalView
  actions: ConsoleActions
  busy: boolean
  error?: string
  /** 初始折叠状态；缺省时折叠，列表优先。 */
  defaultCollapsed?: boolean
  onSubmit: (draft: ApprovalDraft) => void
}

export function ApprovalCard({
  t,
  language,
  sessionId,
  approval,
  actions,
  busy,
  error,
  defaultCollapsed = true,
  onSubmit,
}: ApprovalCardProps): ReactElement {
  const decided = approval.decidedAt !== undefined
  const skipped = approval.decision?.kind === 'skipped'
  const [collapsed, setCollapsed] = useState(defaultCollapsed)
  const [optionIndex, setOptionIndex] = useState<number | undefined>(approval.decision?.index)
  const [answer, setAnswer] = useState(approval.decision?.answer ?? '')
  const locked = decided || busy

  const panelId = `pa-approval-detail-${approval.id}`
  const projected = actions.sessionTitle(approval.requestedBySessionId)
  const requester =
    stripTicketSuffix(projected ?? '') || shortSession(approval.requestedBySessionId)
  const shownAt = decided ? (approval.decidedAt ?? approval.createdAt) : approval.createdAt

  const status: ListRowStatus = decided
    ? skipped
      ? { tone: 'neutral', label: t('approvalSkippedTitle') }
      : { tone: 'success', label: t('approvalDecidedTitle') }
    : { tone: 'warning', label: t('approvalStatusPending') }

  const toggle = (): void => setCollapsed(current => !current)

  return (
    <ListRow
      rowKey={approval.id}
      title={requester}
      summary={approval.question}
      time={formatTimestamp(language, shownAt)}
      status={status}
      action={
        <Button
          className="pa-row__session"
          variant="ghost"
          size="sm"
          icon={<IconLinkOutlineRegular />}
          onClick={() => actions.openSession(approval.requestedBySessionId)}
        >
          {t('approvalOpenSession')}
        </Button>
      }
      expanded={!collapsed}
      onToggle={toggle}
      toggleLabel={t(collapsed ? 'approvalExpand' : 'approvalCollapse')}
      panelId={panelId}
    >
      <div className="pa-detail">
        <p className="pa-detail__question">{approval.question}</p>

        {approval.risk === undefined ? null : (
          <div className="pa-detail__facts">
            <Tag tone={riskTagTone(approval.risk)} className="pa-detail__fact">
              {`${t('approvalRiskLabel')}\uFF1A${t(riskKey(approval.risk))}`}
            </Tag>
          </div>
        )}

        <div className="pa-detail__options" role="radiogroup" aria-label={t('approvalChooseOption')}>
          {approval.options.map((option, index) => (
            <CardOption
              key={`${option.label}-${String(index)}`}
              index={index}
              label={option.label}
              description={option.description}
              selected={optionIndex === index}
              locked={locked}
              onSelect={() => setOptionIndex(index)}
            />
          ))}
        </div>

        {decided ? (
          <CardAnswerText answer={answer} />
        ) : (
          <CardAnswerField
            value={answer}
            placeholder={t('approvalAnswerPlaceholder')}
            disabled={busy}
            onChange={setAnswer}
          />
        )}

        <CardAttachment
          paths={approval.attachments ?? []}
          label={t('attachmentsLabel')}
          openHint={t('attachmentsOpenHint')}
          onOpen={path => actions.openFile(path, sessionId ?? approval.requestedBySessionId)}
        />

        <CardFooter
          current={1}
          total={1}
          feedback={error}
          actions={
            decided ? undefined : (
              <>
                <Button variant="outline" size="sm" disabled={busy} onClick={() => onSubmit({ answer, skip: true })}>
                  {t('approvalSkip')}
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={busy}
                  onClick={() => onSubmit({ optionIndex, answer })}
                >
                  {busy ? t('approvalSubmitting') : t('approvalSubmit')}
                </Button>
              </>
            )
          }
        />
      </div>
    </ListRow>
  )
}
