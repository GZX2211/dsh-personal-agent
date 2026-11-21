// src/client/components/settings/PromptsEditor.tsx
//
// Prompts 编辑器：三份文本分别编辑，保存成一个整体版本；完整提示词页可以看
// Router / Worker 拼装后的全文并与内置默认对比；历史页可以查看旧版本或把它
// 载入编辑器（再保存才生效）。

import { Button, SegmentedControl } from '@deepseek-ai/dsh-client-ui-primitives'
import { useEffect, useState, type ReactElement } from 'react'
import {
  PROMPT_LIMITS,
  PROMPT_PARTS,
  countParagraphs,
  promptStats,
  type PromptPart,
  type PromptTexts,
  type SettingsView,
} from '../../../shared/settings.ts'
import type { Translate } from '../../i18n.ts'
import { formatTimestamp } from '../../lib/format.ts'
import {
  diffLines,
  isSamePromptTexts,
  promptFullText,
  type DiffLine,
} from '../../lib/settings.ts'
import { settingsErrorText } from './errors.ts'
import { SaveBar } from './SaveBar.tsx'
import type { SettingsActions } from './types.ts'

export type PromptsTab = 'edit' | 'full' | 'history'
export type PromptRole = 'router' | 'worker'

export interface PromptsEditorProps {
  t: Translate
  language: string
  view: SettingsView
  actions: SettingsActions
  onSaved: () => void
  onNotice: (message: string) => void
  initialTab?: PromptsTab
  initialPart?: PromptPart
  initialRole?: PromptRole
  initialCompare?: boolean
}

function partLabel(t: Translate, part: PromptPart): string {
  switch (part) {
    case 'shared':
      return t('settingsPromptShared')
    case 'router':
      return t('settingsPromptRouter')
    case 'worker':
      return t('settingsPromptWorker')
  }
}

function roleLabel(t: Translate, role: PromptRole): string {
  return role === 'router' ? t('settingsPromptRouter') : t('settingsPromptWorker')
}

function DiffText({ t, lines }: { t: Translate; lines: readonly DiffLine[] }): ReactElement {
  return (
    <pre className="pa-settings__pre">
      {lines.map((line, index) => {
        if (line.kind === 'fold') {
          return (
            <span key={index} className="pa-settings__diff-fold">
              {t('settingsDiffFold', { count: line.count })}
              {'\n'}
            </span>
          )
        }
        if (line.kind === 'ins') return <ins key={index}>{`${line.text}\n`}</ins>
        if (line.kind === 'del') return <del key={index}>{`${line.text}\n`}</del>
        return <span key={index}>{`${line.text}\n`}</span>
      })}
    </pre>
  )
}

export function PromptsEditor({
  t,
  language,
  view,
  actions,
  onSaved,
  onNotice,
  initialTab = 'edit',
  initialPart = 'shared',
  initialRole = 'router',
  initialCompare = false,
}: PromptsEditorProps): ReactElement {
  const [texts, setTexts] = useState<PromptTexts>(view.prompts.current.texts)
  const [tab, setTab] = useState<PromptsTab>(initialTab)
  const [part, setPart] = useState<PromptPart>(initialPart)
  const [role, setRole] = useState<PromptRole>(initialRole)
  const [compare, setCompare] = useState(initialCompare)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const [history, setHistory] = useState<{ revision: number; texts: PromptTexts }>()
  const [historyBusy, setHistoryBusy] = useState(false)
  const [historyError, setHistoryError] = useState<string>()

  useEffect(() => {
    setTexts(view.prompts.current.texts)
    setError(undefined)
  }, [view.prompts.current.revision])

  const dirty = !isSamePromptTexts(texts, view.prompts.current.texts)
  const stats = promptStats(texts)
  const blankPart = PROMPT_PARTS.find(item => texts[item].trim().length === 0)
  const longPart = PROMPT_PARTS.find(item => texts[item].trim().length > PROMPT_LIMITS.promptPart)
  const invalid = blankPart !== undefined || longPart !== undefined

  const fullText = promptFullText(texts, role, {
    dispatchRules: view.policy.rules,
    permissions: view.policy.permissions,
    policyVersion: view.policy.version,
  })
  const defaultText = promptFullText(view.prompts.defaults, role, {
    dispatchRules: [],
    permissions: [],
    policyVersion: '',
  })
  const fullStats = { parts: countParagraphs(fullText), chars: fullText.length }
  const diff = diffLines(defaultText, fullText)

  const revision = view.prompts.current.revision

  const save = async (): Promise<void> => {
    setBusy(true)
    setError(undefined)
    try {
      await actions.savePrompts(
        {
          shared: texts.shared.trim(),
          router: texts.router.trim(),
          worker: texts.worker.trim(),
        },
        revision,
      )
      onSaved()
    } catch (failure) {
      setError(settingsErrorText(t, failure, t('settingsSaveFailed')))
    } finally {
      setBusy(false)
    }
  }

  const loadVersion = async (target: number): Promise<PromptTexts | undefined> => {
    setHistoryBusy(true)
    setHistoryError(undefined)
    try {
      const version = await actions.loadPromptRevision(target)
      setHistory({ revision: version.revision, texts: version.texts })
      return version.texts
    } catch (failure) {
      setHistoryError(settingsErrorText(t, failure, t('settingsPromptLoadFailed')))
      return undefined
    } finally {
      setHistoryBusy(false)
    }
  }

  const copyFull = async (): Promise<void> => {
    const copied = await actions.copyText(fullText)
    onNotice(t(copied ? 'settingsPromptCopied' : 'settingsPromptCopyFailed'))
  }

  return (
    <div className="pa-settings__section">
      <SegmentedControl
        id="pa-settings-prompts-tabs"
        value={tab}
        options={[
          { value: 'edit', label: t('settingsPromptsEditTab') },
          { value: 'full', label: t('settingsPromptsFullTab') },
          { value: 'history', label: t('settingsPromptsHistoryTab') },
        ]}
        label={t('settingsPromptsTab')}
        onChange={setTab}
      />

      {tab === 'edit' ? (
        <div className="pa-settings__card">
          <div className="pa-settings__head">
            <SegmentedControl
              id="pa-settings-prompt-parts"
              value={part}
              options={PROMPT_PARTS.map(item => ({ value: item, label: partLabel(t, item) }))}
              label={t('settingsPromptsEditTab')}
              onChange={setPart}
            />
          </div>
          <p className="pa-settings__meta">
            {dirty
              ? t('settingsPromptDraftStats', { parts: stats.parts, chars: stats.chars })
              : t('settingsPromptStats', { parts: stats.parts, chars: stats.chars, revision })}
          </p>
          <textarea
            className="pa-settings__textarea pa-settings__editor"
            value={texts[part]}
            aria-label={t('settingsPromptBody')}
            spellCheck={false}
            onChange={event => setTexts({ ...texts, [part]: event.target.value })}
          />
          {blankPart === undefined ? null : (
            <p className="pa-settings__error" role="alert">
              {t('settingsPromptEmpty', { part: partLabel(t, blankPart) })}
            </p>
          )}
          {longPart === undefined ? null : (
            <p className="pa-settings__error" role="alert">
              {t('settingsPromptTooLong', {
                part: partLabel(t, longPart),
                max: PROMPT_LIMITS.promptPart,
              })}
            </p>
          )}
        </div>
      ) : null}

      {tab === 'full' ? (
        <div className="pa-settings__card">
          <div className="pa-settings__head">
            <SegmentedControl
              id="pa-settings-prompt-role"
              value={role}
              options={[
                { value: 'router', label: roleLabel(t, 'router') },
                { value: 'worker', label: roleLabel(t, 'worker') },
              ]}
              label={t('settingsPromptRouter')}
              onChange={setRole}
            />
          </div>
          <p className="pa-settings__meta">
            {dirty
              ? t('settingsPromptDraftStats', { parts: fullStats.parts, chars: fullStats.chars })
              : t('settingsPromptStats', {
                  parts: fullStats.parts,
                  chars: fullStats.chars,
                  revision,
                })}
          </p>
          <div className="pa-settings__head">
            <SegmentedControl
              id="pa-settings-prompt-compare"
              value={compare ? 'default' : 'current'}
              options={[
                { value: 'current', label: t('settingsPromptCompareCurrent') },
                { value: 'default', label: t('settingsPromptCompareDefault') },
              ]}
              label={t('settingsPromptCompare')}
              onChange={value => setCompare(value === 'default')}
            />
            <Button variant="outline" size="sm" onClick={() => void copyFull()}>
              {t('settingsPromptCopy')}
            </Button>
          </div>
          {compare ? <DiffText t={t} lines={diff} /> : <pre className="pa-settings__pre">{fullText}</pre>}
        </div>
      ) : null}

      {tab === 'history' ? (
        <div className="pa-settings__card">
          <p className="pa-settings__help">{t('settingsPromptRestoreHint')}</p>
          {historyError === undefined ? null : (
            <p className="pa-settings__error" role="alert">
              {historyError}
            </p>
          )}
          {view.prompts.history.length === 0 ? (
            <p className="pa-settings__empty">{t('settingsPromptHistoryEmpty')}</p>
          ) : (
            <div className="pa-settings__history">
              {view.prompts.history.map(item => {
                const savedAt = Date.parse(item.savedAt)
                const time = Number.isNaN(savedAt) ? '' : formatTimestamp(language, savedAt)
                return (
                  <div key={item.revision} className="pa-settings__history-item">
                    <div className="pa-settings__history-head">
                      <span className="pa-settings__label">
                        {t('settingsPromptHistoryItem', { revision: item.revision, time })}
                      </span>
                      <span className="pa-settings__meta">
                        {t('settingsPromptHistoryChars', { count: item.chars })}
                      </span>
                    </div>
                    <div className="pa-settings__history-actions">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={historyBusy}
                        onClick={() => {
                          void loadVersion(item.revision)
                        }}
                      >
                        {t('settingsPromptHistoryView')}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={historyBusy}
                        onClick={() => {
                          void loadVersion(item.revision).then(loaded => {
                            if (loaded === undefined) return
                            setTexts(loaded)
                            setTab('edit')
                            onNotice(t('settingsPromptRestoreHint'))
                          })
                        }}
                      >
                        {t('settingsPromptHistoryLoad')}
                      </Button>
                    </div>
                    {history?.revision === item.revision ? (
                      <pre className="pa-settings__pre">{history.texts[part]}</pre>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ) : null}

      {tab === 'edit' ? (
        <SaveBar
          t={t}
          dirty={dirty}
          busy={busy}
          invalid={invalid}
          {...(error === undefined ? {} : { error })}
          onSave={() => {
            void save()
          }}
          onDiscard={() => {
            setTexts(view.prompts.current.texts)
            setError(undefined)
          }}
        />
      ) : null}
    </div>
  )
}
