// src/client/components/SignalCard.tsx
//
// 事件页的一张卡片：类型、来源行、事实文本；结局徽标与时间同在右侧一行，
// 与审批/工单卡片的「徽标 → 时间」排列一致。
//
// 结局里有工单时整枚徽标变成按钮：点开总控台的工单页并定位到那个工单。
// 可点击与不可点击的结局都用同一个 Tag 渲染尺寸，按钮只负责点击区域。

import { Button, Tag, Tooltip, type TagTone } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ReactElement } from 'react'
import type { SignalKind } from '../../shared/events.ts'
import type { SignalView } from '../../shared/signals.ts'
import type { Translate } from '../i18n.ts'
import { formatRelativeTime, formatTimestamp } from '../lib/format.ts'
import {
  signalKindKey,
  signalSourceText,
  signalVerdict,
  verdictText,
  type SignalVerdict,
} from '../lib/signals.ts'

export interface SignalCardProps {
  t: Translate
  language: string
  now: number
  signal: SignalView
  /** 点结局跳工单；缺省时结局只读。 */
  onOpenTicket?: (ticketId: string) => void
  /** 紧凑排版：来源页的「最近信号」用，不再重复来源行。 */
  compact?: boolean
}

const KIND_TONES: Record<SignalKind, TagTone> = {
  'user-message': 'info',
  timer: 'warning',
  perception: 'neutral',
}

const VERDICT_TONES: Record<SignalVerdict['kind'], TagTone> = {
  pending: 'warning',
  filtered: 'neutral',
  dispatch: 'info',
  append: 'info',
  supplement: 'info',
  reply: 'success',
}

export function SignalCard({
  t,
  language,
  now,
  signal,
  onOpenTicket,
  compact = false,
}: SignalCardProps): ReactElement {
  const verdict = signalVerdict(signal)
  const ticketId =
    verdict.kind === 'dispatch' || verdict.kind === 'append' ? verdict.ticketId : undefined
  const clickable = ticketId !== undefined && ticketId.length > 0 && onOpenTicket !== undefined
  const className = compact ? 'pa-signal pa-signal--compact' : 'pa-signal'

  const badge = (
    <Tag tone={VERDICT_TONES[verdict.kind]} className="pa-signal__verdict-tag">
      {verdictText(t, verdict)}
    </Tag>
  )

  return (
    <article className={className} role="listitem" data-row-key={signal.signalId}>
      <div className="pa-signal__head">
        <Tag tone={KIND_TONES[signal.kind]} className="pa-signal__kind">
          {t(signalKindKey(signal.kind))}
        </Tag>
        {compact ? null : (
          <span className="pa-signal__source" title={signalSourceText(t, signal)}>
            {signalSourceText(t, signal)}
          </span>
        )}
        <div className="pa-signal__aside">
          {clickable ? (
            <Tooltip label={t('eventOpenTicket')} side="top">
              <Button
                className="pa-signal__verdict"
                variant="ghost"
                size="sm"
                onClick={() => onOpenTicket(ticketId)}
              >
                {badge}
              </Button>
            </Tooltip>
          ) : (
            <span className="pa-signal__verdict">{badge}</span>
          )}
          {verdict.kind === 'reply' && verdict.inferred ? (
            <Tooltip label={t('eventInferredHint')} side="top">
              <Tag tone="quiet" className="pa-signal__inferred">
                {t('eventInferred')}
              </Tag>
            </Tooltip>
          ) : null}
          <Tooltip label={formatTimestamp(language, signal.receivedAt)} side="top" align="end">
            <time className="pa-signal__time" dateTime={new Date(signal.receivedAt).toISOString()}>
              {formatRelativeTime(t, language, signal.receivedAt, now)}
            </time>
          </Tooltip>
        </div>
      </div>

      <p className="pa-signal__text">{signal.text}</p>
    </article>
  )
}
