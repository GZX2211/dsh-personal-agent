// src/client/styles/index.ts
//
// 样式聚合入口：各领域片段在这里按固定顺序拼成一个 style 块，只注入一次。
// 组件只从本文件导入 CONSOLE_CSS，不直接引用领域片段，避免重复注入与顺序漂移。
//
// 顺序约定：Token → 外壳 → 通用骨架 → 各领域。各文件的选择器互斥，顺序不承载级联语义。

import { APPROVALS_CSS } from './approvals.ts'
import { EVENTS_CSS } from './events.ts'
import { OVERVIEW_CHART_CSS } from './overview/chart.ts'
import { OVERVIEW_CONTEXT_CSS } from './overview/context.ts'
import { OVERVIEW_CSS } from './overview/index.ts'
import { SETTINGS_FORM_CSS } from './settings/form.ts'
import { SETTINGS_POLICY_CSS } from './settings/policy.ts'
import { SHARED_CSS } from './shared.ts'
import { SHELL_CSS } from './shell.ts'
import { SOURCES_CSS } from './sources.ts'
import { TICKET_CHAIN_CSS } from './ticket-detail/chain.ts'
import { TICKET_FOLDS_CSS } from './ticket-detail/folds.ts'
import { TICKET_HEADER_CSS } from './ticket-detail/header.ts'
import { TICKET_LANES_CSS } from './ticket-detail/lanes.ts'
import { TICKET_STREAM_CSS } from './ticket-detail/stream.ts'
import { TICKET_TIMELINE_CSS } from './ticket-detail/timeline.ts'
import { TOKENS_CSS } from './tokens.ts'

export const CONSOLE_CSS = [
  TOKENS_CSS,
  SHELL_CSS,
  SHARED_CSS,
  APPROVALS_CSS,
  SOURCES_CSS,
  EVENTS_CSS,
  OVERVIEW_CSS,
  OVERVIEW_CHART_CSS,
  OVERVIEW_CONTEXT_CSS,
  SETTINGS_FORM_CSS,
  SETTINGS_POLICY_CSS,
  TICKET_HEADER_CSS,
  TICKET_TIMELINE_CSS,
  TICKET_LANES_CSS,
  TICKET_CHAIN_CSS,
  TICKET_STREAM_CSS,
  TICKET_FOLDS_CSS,
].join('\n')
