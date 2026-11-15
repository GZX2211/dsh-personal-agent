// src/client/components/ApprovalCard.tsx
//
// 一张审批卡：结构照搬官方 `ask_user_question` 提问卡（头部、题干、选项、
// 「输入你的答案」、分页页脚），只多两处——
// 卡顶的发起者 / 关联工单 / 时间，以及卡底的附件行。
//
// 两种形态：
// - 待审批：默认展开，可以选一个选项、写自由文本，或直接跳过；
// - 已通过：默认折叠，展开后是同一张卡片的只读态（选中项高亮、无动作按钮）。

import { useState, type ReactElement } from 'react'
import type { ApprovalView } from '../../shared/approvals.ts'
import type { TicketView } from '../../shared/tickets.ts'
import type { ConsoleActions } from '../actions.ts'
import type { Translate } from '../i18n.ts'
import { shortSession, shortTicket, type ApprovalDraft } from '../lib/approvals.ts'
import { formatTimestamp } from '../lib/format.ts'
import { CardAnswerField, CardAnswerText } from './card/CardAnswer.tsx'
import { CardAttachment } from './card/CardAttachment.tsx'
import { CardFooter } from './card/CardFooter.tsx'
import { CardFrame } from './card/CardFrame.tsx'
import { CardHeader } from './card/CardHeader.tsx'
import { CardOption } from './card/CardOption.tsx'
import { Button } from './card/Button.tsx'

export interface ApprovalCardProps {
  t: Translate
  language: string
  approval: ApprovalView
  /** 关联工单的标题；快照里找不到时回退到短码。 */
  tickets: ReadonlyMap<string, TicketView>
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
  approval,
  tickets,
  actions,
  busy,
  error,
  defaultCollapsed,
  onSubmit,
}: ApprovalCardProps): ReactElement {
  const decided = approval.decidedAt !== undefined
  const [collapsed, setCollapsed] = useState(defaultCollapsed ?? decided)
  const [optionIndex, setOptionIndex] = useState<number | undefined>(approval.decision?.index)
  const [note, setNote] = useState(approval.decision?.note ?? '')
  const locked = decided || busy

  const titleId = `pa-approval-${approval.id}`
  const requester = actions.sessionTitle(approval.requestedBySessionId) ?? shortSession(approval.requestedBySessionId)
  const ticket = tickets.get(approval.ticketId)
  const ticketTitle = ticket === undefined ? `#${shortTicket(approval.ticketId)}` : ticket.title
  const shownAt = decided ? (approval.decidedAt ?? approval.createdAt) : approval.createdAt
  const status = decided ? t(approval.decision?.kind === 'skipped' ? 'approvalSkippedTitle' : 'approvalDecidedTitle') : undefined

  return (
    <CardFrame collapsed={collapsed} labelledBy={collapsed ? titleId : undefined}>
      <CardHeader
        eyebrow={
          <>
            <button type="button" className="pa-card__link" onClick={() => actions.openSession(approval.requestedBySessionId)}>
              {`${t('approvalRequester')}\uFF1A`}
              {requester}
            </button>
            <button type="button" className="pa-card__link" onClick={() => actions.showTickets(approval.ticketId)}>
              {`${t('approvalTicket')}\uFF1A`}
              {ticketTitle}
            </button>
          </>
        }
        title={collapsed ? approval.question : undefined}
        titleId={titleId}
        time={formatTimestamp(language, shownAt)}
        status={status}
        collapsed={collapsed}
        onToggle={() => setCollapsed(current => !current)}
        toggleLabel={t(collapsed ? 'approvalExpand' : 'approvalCollapse')}
      />

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
              <CardAnswerText note={note} />
            ) : (
              <CardAnswerField
                value={note}
                placeholder={t('approvalAnswerPlaceholder')}
                disabled={busy}
                onChange={setNote}
              />
            )}

            <CardAttachment
              paths={approval.attachments ?? []}
              label={t('attachmentsLabel')}
              openHint={t('attachmentsOpenHint')}
              onOpen={path => actions.openFile(path)}
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
                  <Button variant="outline" disabled={busy} onClick={() => onSubmit({ note })}>
                    {t('approvalSkip')}
                  </Button>
                  <Button
                    variant="primary"
                    disabled={busy}
                    onClick={() => onSubmit({ optionIndex, note })}
                  >
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
