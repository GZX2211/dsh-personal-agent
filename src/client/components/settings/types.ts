// src/client/components/settings/types.ts
//
// 设置页的共享类型：分段、保存动作面。动作由容器注入，编辑器不直接发请求。

import type {
  DispatchRule,
  ExecutorSettings,
  PromptTexts,
  PromptVersion,
} from '../../../shared/settings.ts'

export type SettingsSection = 'rules' | 'executor' | 'prompts'

export interface SettingsActions {
  savePolicy(rules: readonly DispatchRule[], revision: number): Promise<void>
  saveExecutor(executor: ExecutorSettings, revision: number): Promise<void>
  savePrompts(texts: PromptTexts, baseRevision: number): Promise<void>
  loadPromptRevision(revision: number): Promise<PromptVersion>
  copyText(text: string): Promise<boolean>
  refresh(): Promise<void>
}
