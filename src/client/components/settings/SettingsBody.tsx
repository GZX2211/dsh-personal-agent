// src/client/components/settings/SettingsBody.tsx
//
// 设置页正文：顶部分段切三块；每块一个编辑器，各自持有草稿与保存条。
// 初始分段与提示词子页可以通过 props 指定，方便测试与以后从别处深链。

import { SegmentedControl } from '@deepseek-ai/dsh-client-ui-primitives'
import { useState, type ReactElement } from 'react'
import type { PromptPart, SettingsView } from '../../../shared/settings.ts'
import type { Translate } from '../../i18n.ts'
import { ExecutorEditor } from './ExecutorEditor.tsx'
import { PromptsEditor, type PromptRole, type PromptsTab } from './PromptsEditor.tsx'
import { RulesEditor } from './RulesEditor.tsx'
import type { SettingsActions, SettingsSection } from './types.ts'

export interface SettingsBodyProps {
  t: Translate
  language: string
  view: SettingsView
  actions: SettingsActions
  onSaved: () => void
  onNotice: (message: string) => void
  initialSection?: SettingsSection
  initialPromptsTab?: PromptsTab
  initialPromptPart?: PromptPart
  initialRole?: PromptRole
  initialCompare?: boolean
}

export function SettingsBody({
  t,
  language,
  view,
  actions,
  onSaved,
  onNotice,
  initialSection = 'rules',
  initialPromptsTab,
  initialPromptPart,
  initialRole,
  initialCompare,
}: SettingsBodyProps): ReactElement {
  const [section, setSection] = useState<SettingsSection>(initialSection)

  return (
    <div className="pa-settings__body">
      <SegmentedControl
        id="pa-settings-sections"
        value={section}
        options={[
          { value: 'rules', label: t('settingsRulesTab') },
          { value: 'executor', label: t('settingsExecutorTab') },
          { value: 'prompts', label: t('settingsPromptsTab') },
        ]}
        label={t('tabSettings')}
        onChange={setSection}
      />

      {section === 'rules' ? (
        <RulesEditor t={t} view={view} actions={actions} onSaved={onSaved} />
      ) : null}
      {section === 'executor' ? (
        <ExecutorEditor t={t} view={view} actions={actions} onSaved={onSaved} />
      ) : null}
      {section === 'prompts' ? (
        <PromptsEditor
          t={t}
          language={language}
          view={view}
          actions={actions}
          onSaved={onSaved}
          onNotice={onNotice}
          {...(initialPromptsTab === undefined ? {} : { initialTab: initialPromptsTab })}
          {...(initialPromptPart === undefined ? {} : { initialPart: initialPromptPart })}
          {...(initialRole === undefined ? {} : { initialRole })}
          {...(initialCompare === undefined ? {} : { initialCompare })}
        />
      ) : null}
    </div>
  )
}
