// src/client/components/ApprovalCard.tsx
//
// 一张审批卡：结构沿用官方 `ask_user_question` 提问卡（题干、选项、
// 「输入你的答案」、分页页脚），度量收敛到宿主主界面的刻度。
//
// 与官方只有两处不同：卡头的发起者会话名与时间、卡底的附件行。
//
// 两种形态：
// - 待审批：默认展开，可以选一个选项、写自由文本，或直接跳过；
// - 已通过：默认折叠，展开后是同一张卡片的只读态（选中项高亮、无动作按钮）。

import { useState, type ReactElement } from 'react'
import type { ApprovalView } from '../../shared/approvals.ts'
import type { ConsoleActions } from '../actions.ts'
import type { Translate } from '../i18n.ts'
import { shortSession, type ApprovalDraft } from '../lib/approvals.ts'
import { formatTimestamp } from '../lib/format.ts'
import { CardAnswerField, CardAnswerText } from './card/CardAnswer.tsx'
import { CardAttachment } from './card/CardAttachment.tsx'
import { CardFooter } from './card/CardFooter.tsx'
import { CardFrame } from './card/CardFrame.tsx'
import { CardHeader } from './card/CardHeader.tsx'
import { CardOption } from './card/CardOption.tsx'
import { Badge } from './card/Badge.tsx'
import { Button } from './card/Button.tsx'

export interface ApprovalCardProps {
  t: Translate
  language: string
  /** 右侧栏所在会话；文件预览用它授权读取。 */
  sessionId?: string
  approval: ApprovalView
  actions: ConsoleActions
  busy: boolean
  error?: string
  /** 初始折叠状态；缺省时待审批展开、已通过折叠。 */
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
  defaultCollapsed,
  onSubmit,
}: ApprovalCardProps): ReactElement {
  const decided = approval.decidedAt !== undefined
  const skipped = approval.decision?.kind === 'skipped'
  const [collapsed, setCollapsed] = useState(defaultCollapsed ?? decided)
  const [optionIndex, setOptionIndex] = useState<number | undefined>(approval.decision?.index)
  const [answer, setAnswer] = useState(approval.decision?.answer ?? '')
  const locked = decided || busy

  const titleId = `pa-approval-${approval.id}`
  const requester = actions.sessionTitle(approval.requestedBySessionId) ?? shortSession(approval.requestedBySessionId)
  const shownAt = decided ? (approval.decidedAt ?? approval.createdAt) : approval.createdAt

  return (
    <CardFrame collapsed={collapsed} labelledBy={collapsed ? titleId : undefined}>
      <CardHeader
        meta={
          <button
            type="button"
            className="pa-card__link pa-card__meta-item pa-card__meta-strong"
            title={requester}
            onClick={() => actions.openSession(approval.requestedBySessionId)}
          >
            {requester}
          </button>
        }
        time={formatTimestamp(language, shownAt)}
        badge={
          decided ? (
            <Badge tone={skipped ? 'idle' : 'success'}>{t(skipped ? 'approvalSkippedTitle' : 'approvalDecidedTitle')}</Badge>
          ) : undefined
        }
        collapsed={collapsed}
        onToggle={() => setCollapsed(current => !current)}
        toggleLabel={t(collapsed ? 'approvalExpand' : 'approvalCollapse')}
      />

      {collapsed ? (
        <div className="pa-card__body">
          <h2 className="pa-card__collapsed-title" id={titleId}>
            {approval.question}
          </h2>
        </div>
      ) : null}

      {collapsed ? null : (
        <>
          <div className="pa-card__body">
            <h2 className="pa-card__question" id={titleId}>
              {approval.question}
            </h2>

            <div className="pa-card__options" role="radiogroup" aria-label={t('approvalChooseOption')}>
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
          </div>

          <CardFooter
            current={1}
            total={1}
            prevLabel={t('pagerPrev')}
            nextLabel={t('pagerNext')}
            feedback={error}
            actions={
              decided ? undefined : (
                <>
                  <Button variant="outline" disabled={busy} onClick={() => onSubmit({ answer, skip: true })}>
                    {t('approvalSkip')}
                  </Button>
                  <Button variant="primary" disabled={busy} onClick={() => onSubmit({ optionIndex, answer })}>
                    {busy ? t('approvalSubmitting') : t('approvalSubmit')}
                  </Button>
                </>
              )
            }
          />
        </>
      )}
    </CardFrame>
  )
}
