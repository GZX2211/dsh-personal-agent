// src/client/components/SourceCard.tsx
//
// 来源页的一张卡片：名称、渠道、运行时状态、线程数与最近触发；展开后是线程开关、
// 配置摘要、最近测试产生的信号与三个操作（测试 / 重启 / 删除）。
//
// 开关、测试与删除都只是「请求」：乐观状态由页面给，失败由页面回滚并提示。

import {
  Button,
  IconChevronDownOutlineRegular,
  Modal,
  StateDot,
  Switch,
  Tag,
  Tooltip,
} from '@deepseek-ai/dsh-client-ui-primitives'
import { useState, type ReactElement } from 'react'
import type { SignalView } from '../../shared/signals.ts'
import type { SourceView } from '../../shared/sources.ts'
import type { Dict, Translate } from '../i18n.ts'
import { formatRelativeTime } from '../lib/format.ts'
import {
  channelKindKey,
  sourceConfigText,
  sourceStatusDot,
  sourceStatusKey,
  threadCountText,
} from '../lib/sources.ts'
import { SignalCard } from './SignalCard.tsx'
import { ThreadRow } from './ThreadRow.tsx'

export interface SourceCardProps {
  t: Translate
  language: string
  now: number
  source: SourceView
  /** 页面的乐观覆盖：来源开关。 */
  enabled: boolean
  /** 页面的乐观覆盖：线程开关（线程 id → enabled）。 */
  threadEnabled: Readonly<Record<string, boolean>>
  /** 有写操作在途：来源级动作与全部线程开关一起禁用。 */
  busy: boolean
  deleting: boolean
  /** 最近一次测试返回的信号；未测试过为 undefined。 */
  testResult?: SignalView[]
  onToggleSource: (enabled: boolean) => void
  onToggleThread: (threadId: string, enabled: boolean) => void
  onTest: () => void
  onRestart: () => void
  onRemove: () => void
  /** 初始折叠状态；缺省时折叠，列表优先。 */
  defaultCollapsed?: boolean
}

export function SourceCard({
  t,
  language,
  now,
  source,
  enabled,
  threadEnabled,
  busy,
  deleting,
  testResult,
  onToggleSource,
  onToggleThread,
  onTest,
  onRestart,
  onRemove,
  defaultCollapsed = true,
}: SourceCardProps): ReactElement {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)
  const [confirming, setConfirming] = useState(false)

  const configLabel: keyof Dict =
    source.config.kind === 'host-event'
      ? 'sourceConfigEvents'
      : source.config.kind === 'fs-watch'
        ? 'sourceConfigPaths'
        : 'sourceConfigCommand'

  return (
    <article className="pa-row" role="listitem" data-row-key={source.id} data-expanded={!collapsed}>
      <div className="pa-row__head">
        <div className="pa-row__body">
          <div className="pa-row__titleline">
            <h3 className="pa-row__title">{source.name}</h3>
            <div className="pa-row__aside">
              <StateDot state={sourceStatusDot(source.status)} className="pa-source__dot" />
              <span className="pa-source__status">{t(sourceStatusKey(source.status))}</span>
              <Tag tone="outline" className="pa-source__channel">
                {t(channelKindKey(source.channelKind))}
              </Tag>
              <Switch
                className="pa-source__switch"
                checked={enabled}
                disabled={busy}
                label={source.name}
                onChange={onToggleSource}
              />
              <Tooltip label={t(collapsed ? 'sourceExpand' : 'sourceCollapse')} side="left">
                <Button
                  className="pa-row__toggle"
                  variant="ghost"
                  size="sm"
                  icon={<IconChevronDownOutlineRegular />}
                  aria-expanded={!collapsed}
                  aria-controls={collapsed ? undefined : `pa-source-detail-${source.id}`}
                  aria-label={t(collapsed ? 'sourceExpand' : 'sourceCollapse')}
                  onClick={() => setCollapsed(current => !current)}
                />
              </Tooltip>
            </div>
          </div>

          <p className="pa-row__summary">
            {source.description ?? sourceConfigText(language, source.config)}
          </p>

          <div className="pa-row__footer">
            <span className="pa-source__threads-summary">
              {threadCountText(t, source.threads.length)}
            </span>
            <Tooltip label={t('sourcesLastEvent')} side="top" align="end">
              <span className="pa-row__time">
                {source.lastEventAt === undefined
                  ? t('sourcesNever')
                  : formatRelativeTime(t, language, source.lastEventAt, now)}
              </span>
            </Tooltip>
          </div>
        </div>
      </div>

      {collapsed ? null : (
        <div className="pa-row__detail" id={`pa-source-detail-${source.id}`}>
          <div className="pa-source__threads">
            {source.threads.map(thread => (
              <ThreadRow
                key={thread.id}
                t={t}
                language={language}
                now={now}
                thread={thread}
                busy={busy}
                enabled={threadEnabled[thread.id] ?? thread.enabled}
                onToggle={next => onToggleThread(thread.id, next)}
              />
            ))}
          </div>

          <p className="pa-source__config">
            <span className="pa-source__config-label">{t(configLabel)}</span>
            <span className="pa-source__config-value">{sourceConfigText(language, source.config)}</span>
          </p>

          {source.lastError === undefined ? null : (
            <p className="pa-source__error" role="alert">
              {source.lastError}
            </p>
          )}

          <div className="pa-source__actions">
            <Button variant="outline" size="sm" disabled={busy} onClick={onTest}>
              {busy ? t('sourceTesting') : t('sourceTest')}
            </Button>
            {source.status === 'error' ? (
              <Button variant="outline" size="sm" disabled={busy} onClick={onRestart}>
                {t('sourceRestart')}
              </Button>
            ) : null}
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => setConfirming(true)}>
              {t('sourceRemove')}
            </Button>
          </div>

          {testResult === undefined ? null : (
            <div className="pa-source__test">
              <p className="pa-source__test-title">{t('sourceTestResult')}</p>
              {testResult.length === 0 ? (
                <p className="pa-source__test-empty">{t('sourceTestEmpty')}</p>
              ) : (
                <div className="pa-source__test-list" role="list">
                  {testResult.map(signal => (
                    <SignalCard
                      key={signal.signalId}
                      t={t}
                      language={language}
                      now={now}
                      signal={signal}
                      compact
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title={t('sourceRemoveTitle')}
        closeLabel={t('sourceRemoveClose')}
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setConfirming(false)}>
              {t('sourceRemoveCancel')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={deleting}
              onClick={() => {
                setConfirming(false)
                onRemove()
              }}
            >
              {deleting ? t('sourceDeleting') : t('sourceRemoveConfirm')}
            </Button>
          </>
        }
      >
        <p className="pa-help-text">{t('sourceRemoveBody')}</p>
      </Modal>
    </article>
  )
}
