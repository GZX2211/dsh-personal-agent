// src/client/components/settings/ExecutorEditor.tsx
//
// 执行器编辑器：模型只读地取自官方目录，三个下拉分别选服务商/模型/推理强度；
// 全空表示继承 DSH 默认。并行工单数与执行根目录各有独立边界。
//
// 已保存但目录里已不可用的选择仍原样显示并标记，用户可重新选择或清空。

import { Input } from '@deepseek-ai/dsh-client-ui-primitives'
import { useEffect, useState, type ReactElement } from 'react'
import {
  MAX_WORKERS,
  formatWorkerModel,
  type SettingsView,
  type WorkerModel,
} from '../../../shared/settings.ts'
import type { Translate } from '../../i18n.ts'
import {
  executorDraftError,
  executorDraftValue,
  isSameExecutor,
  modelAvailable,
  reasoningOptions,
  type ExecutorDraft,
} from '../../lib/settings.ts'
import { settingsErrorText } from './errors.ts'
import { SaveBar } from './SaveBar.tsx'
import type { SettingsActions } from './types.ts'

export interface ExecutorEditorProps {
  t: Translate
  view: SettingsView
  actions: SettingsActions
  onSaved: () => void
}

function draftOf(view: SettingsView): ExecutorDraft {
  return {
    maxWorkers: String(view.executor.maxWorkers),
    model: view.executor.model,
    rootDirectory: view.executor.rootDirectory ?? '',
  }
}

export function ExecutorEditor({ t, view, actions, onSaved }: ExecutorEditorProps): ReactElement {
  const [draft, setDraft] = useState<ExecutorDraft>(() => draftOf(view))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  useEffect(() => {
    setDraft(draftOf(view))
    setError(undefined)
  }, [view.revision])

  const model = draft.model
  const provider = model?.provider ?? ''
  const providerGroup = view.models.providers.find(item => item.id === provider)
  const providerKnown = provider === '' || providerGroup !== undefined
  const availableModels = providerGroup?.models ?? []
  const modelKnown = model === null || availableModels.some(item => item.id === model.model)
  const efforts = reasoningOptions(view.models, model)
  const effort = model?.reasoningEffort ?? ''
  const effortKnown = effort === '' || efforts.some(item => item.id === effort)
  const unavailable = model !== null && !modelAvailable(view.models, model)

  const draftError = executorDraftError(draft)
  const dirty = !isSameExecutor(executorDraftValue(draft), view.executor)
  const invalid = draftError !== undefined

  const setProvider = (id: string): void => {
    if (id === '') {
      setDraft(current => ({ ...current, model: null }))
      return
    }
    const first = view.models.providers.find(item => item.id === id)?.models[0]
    setDraft(current => ({
      ...current,
      model: first === undefined ? { provider: id, model: '' } : { provider: id, model: first.id },
    }))
  }

  const setModel = (id: string): void => {
    const current = draft.model
    if (current === null) return
    const nextEfforts = reasoningOptions(view.models, { provider: current.provider, model: id })
    const keepEffort =
      current.reasoningEffort !== undefined &&
      nextEfforts.some(item => item.id === current.reasoningEffort)
    setDraft(previous => ({
      ...previous,
      model: {
        provider: current.provider,
        model: id,
        ...(keepEffort && current.reasoningEffort !== undefined
          ? { reasoningEffort: current.reasoningEffort }
          : {}),
      },
    }))
  }

  const setEffort = (id: string): void => {
    const current = draft.model
    if (current === null) return
    if (id === '') {
      const { reasoningEffort: _dropped, ...rest } = current
      setDraft(previous => ({ ...previous, model: rest }))
      return
    }
    setDraft(previous => ({
      ...previous,
      model: { provider: current.provider, model: current.model, reasoningEffort: id },
    }))
  }

  const save = async (): Promise<void> => {
    setBusy(true)
    setError(undefined)
    try {
      await actions.saveExecutor(executorDraftValue(draft), view.revision)
      onSaved()
    } catch (failure) {
      setError(settingsErrorText(t, failure, t('settingsSaveFailed')))
    } finally {
      setBusy(false)
    }
  }

  const defaultModel = view.models.default

  return (
    <div className="pa-settings__section">
      <div className="pa-settings__card">
        <h3 className="pa-settings__title">{t('settingsExecutorModel')}</h3>
        <p className="pa-settings__help">{t('settingsExecutorIntro')}</p>
        <p className="pa-settings__meta">
          {defaultModel === null
            ? t('settingsExecutorDefaultUnknown')
            : t('settingsExecutorDefault', { model: formatWorkerModel(defaultModel) })}
        </p>

        <div className="pa-settings__fields">
          <label className="pa-settings__field">
            <span className="pa-settings__label">{t('settingsModelProvider')}</span>
            <select
              className="pa-settings__select"
              value={provider}
              aria-label={t('settingsModelProvider')}
              onChange={event => setProvider(event.target.value)}
            >
              <option value="">{t('settingsModelInherit')}</option>
              {providerKnown ? null : <option value={provider}>{provider}</option>}
              {view.models.providers.map(item => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>

          <label className="pa-settings__field">
            <span className="pa-settings__label">{t('settingsModelName')}</span>
            <select
              className="pa-settings__select"
              value={model?.model ?? ''}
              aria-label={t('settingsModelName')}
              disabled={model === null}
              onChange={event => setModel(event.target.value)}
            >
              <option value="">{t('settingsModelInherit')}</option>
              {model !== null && !modelKnown ? <option value={model.model}>{model.model}</option> : null}
              {availableModels.map(item => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>

          <label className="pa-settings__field">
            <span className="pa-settings__label">{t('settingsModelEffort')}</span>
            <select
              className="pa-settings__select"
              value={effort}
              aria-label={t('settingsModelEffort')}
              disabled={model === null || efforts.length === 0}
              onChange={event => setEffort(event.target.value)}
            >
              <option value="">{t('settingsModelEffortDefault')}</option>
              {effort !== '' && !effortKnown ? <option value={effort}>{effort}</option> : null}
              {efforts.map(item => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {unavailable ? (
          <p className="pa-settings__error" role="status">
            {t('settingsModelUnavailable')}
          </p>
        ) : null}
        {view.models.failures.map(failure => (
          <p key={failure.id} className="pa-settings__help">
            {failure.name}: {failure.message}
          </p>
        ))}
      </div>

      <div className="pa-settings__card">
        <label className="pa-settings__field">
          <span className="pa-settings__label">{t('settingsMaxWorkers')}</span>
          <Input
            type="number"
            min={MAX_WORKERS.min}
            max={MAX_WORKERS.max}
            value={draft.maxWorkers}
            aria-label={t('settingsMaxWorkers')}
            onChange={event =>
              setDraft(current => ({ ...current, maxWorkers: event.target.value }))
            }
          />
          <span className="pa-settings__help">
            {t('settingsMaxWorkersHint', {
              min: MAX_WORKERS.min,
              max: MAX_WORKERS.max,
            })}
          </span>
          {draftError === 'maxWorkersInvalid' ? (
            <span className="pa-settings__error" role="alert">
              {t('settingsMaxWorkersInvalid', { min: MAX_WORKERS.min, max: MAX_WORKERS.max })}
            </span>
          ) : null}
        </label>
      </div>

      <div className="pa-settings__card">
        <label className="pa-settings__field">
          <span className="pa-settings__label">{t('settingsRootDirectory')}</span>
          <Input
            value={draft.rootDirectory}
            placeholder={t('settingsRootDirectoryPlaceholder')}
            aria-label={t('settingsRootDirectory')}
            onChange={event =>
              setDraft(current => ({ ...current, rootDirectory: event.target.value }))
            }
          />
          <span className="pa-settings__help">
            {t('settingsRootDirectoryDefault', { root: view.defaultRoot })}
          </span>
          {draftError === 'rootNotAbsolute' ? (
            <span className="pa-settings__error" role="alert">
              {t('settingsRootInvalid')}
            </span>
          ) : null}
        </label>
      </div>

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
          setDraft(draftOf(view))
          setError(undefined)
        }}
      />
    </div>
  )
}
