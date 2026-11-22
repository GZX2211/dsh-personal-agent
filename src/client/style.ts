// src/client/style.ts
//
// 面板样式：颜色/圆角/字号/阴影一律取宿主 design token，不复制设计变量。
//
// 官方的控件（Button / Pill / Input / Modal / Tag / Tooltip）直接由
// `@deepseek-ai/dsh-client-ui-primitives` 提供，本文件不再定义它们的外观；
// 这里只保留官方没有的三类东西：面板骨架、列表行、审批详情。
//
// 排版跟宿主主界面同一套刻度：
//   · 字号：14 正文 / 13 次要 / 12 小字与时间 / 11 徽标
//   · 行高：22 正文 / 20 次要 / 18 小字
//   · 列表行内边距 10px 12px，详情与行头正文共用 32px 左基线
//
// 构建链路没有 CSS Module 管线（客户端产物是单个 CJS 文件），因此样式集中
// 在本文件；类名用 `pa-` 前缀隔离，避免与宿主样式串味。

export const CONSOLE_CSS = `
/* ── 面板骨架 ───────────────────────────────────────────────────────── */
.pa-console {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  color: inherit;
  font-size: 13px;
}
.pa-console__tabs {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: nowrap;
  gap: 0 24px;
  align-items: stretch;
  box-sizing: border-box;
  min-width: 0;
  min-height: 38px;
  padding: 0 16px;
  overflow-x: auto;
  scrollbar-width: none;
  border-bottom: 0.5px solid var(--dsw-alias-border-l2);
}
.pa-console__tabs::-webkit-scrollbar {
  display: none;
}
.pa-console__tab {
  position: relative;
  display: inline-flex;
  align-items: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--dsw-alias-label-tertiary);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
  white-space: nowrap;
  cursor: pointer;
  transition: color 120ms ease;
}
.pa-console__tab:hover {
  color: var(--dsw-alias-label-primary);
}
.pa-console__tab[aria-selected='true'] {
  color: var(--dsw-alias-label-primary);
}
.pa-console__tab:focus-visible {
  outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
  outline-offset: 2px;
  border-radius: 2px;
}
.pa-console__tab::after {
  content: '';
  position: absolute;
  right: 0;
  bottom: -1px;
  left: 0;
  height: 2px;
  border-radius: 2px 2px 0 0;
  background: transparent;
}
.pa-console__tab[aria-selected='true']::after {
  background: var(--dsw-alias-label-primary);
}
.pa-console__count {
  margin-left: 4px;
}
.pa-console__body {
  position: relative;
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
}
.pa-console__empty {
  display: block;
  margin: auto;
  padding: 24px 16px;
  color: var(--dsw-alias-label-tertiary);
  font-size: 13px;
  line-height: 20px;
  text-align: center;
}

/* ── 设置页：窄区域单列卡片 ─────────────────────────────────────────── */
.pa-settings {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  box-sizing: border-box;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}
.pa-settings__body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  box-sizing: border-box;
  padding: 10px 16px 16px;
}
.pa-settings__section {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}
.pa-settings__card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  box-sizing: border-box;
  min-width: 0;
  padding: 10px 12px;
  border: 0.5px solid var(--dsw-alias-border-l2);
  border-radius: var(--dsw-radius-lg);
  background: var(--dsw-alias-bg-layer-1);
}
.pa-settings__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
}
.pa-settings__title {
  margin: 0;
  color: var(--dsw-alias-label-primary);
  font-size: 14px;
  font-weight: 500;
  line-height: 22px;
}
.pa-settings__meta {
  margin: 0;
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  line-height: 18px;
  overflow-wrap: anywhere;
}
.pa-settings__help {
  margin: 0;
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  line-height: 18px;
  overflow-wrap: anywhere;
}
.pa-settings__empty {
  margin: 0;
  padding: 8px 0;
  color: var(--dsw-alias-label-tertiary);
  font-size: 13px;
  line-height: 20px;
  text-align: center;
}
.pa-settings__error {
  margin: 0;
  color: var(--dsw-alias-state-error-primary);
  font-size: 12px;
  line-height: 18px;
  overflow-wrap: anywhere;
}
/* ── 策略：统一版本条与折叠规则行 ─────────────────────────────────── */
.pa-policy__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 6px 12px;
  padding: 0 2px;
}
.pa-policy__hint {
  margin: 0;
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  line-height: 18px;
  overflow-wrap: anywhere;
}
.pa-policy__version {
  flex: none;
  padding: 1px 8px;
  border: 0.5px solid var(--dsw-alias-border-l2);
  border-radius: 999px;
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  line-height: 18px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.pa-rules {
  gap: 6px;
}
.pa-rules__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
}
.pa-rules__heading {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.pa-rules__count {
  flex: none;
  min-width: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-tertiary);
  font-size: 11px;
  line-height: 16px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}
.pa-rules__add {
  flex: none;
}
.pa-rules__empty {
  margin: 0;
  padding: 14px 12px;
  border: 0.5px dashed var(--dsw-alias-border-l3);
  border-radius: var(--dsw-radius-md);
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  line-height: 18px;
  text-align: center;
}
.pa-rules__list {
  display: flex;
  flex-direction: column;
  margin-top: 2px;
}
.pa-rule {
  border-top: 0.5px solid var(--dsw-alias-border-l1);
}
.pa-rule:first-child {
  border-top: 0;
}
.pa-rule[data-open] {
  margin: 2px 0;
  border-top-color: transparent;
  border-radius: var(--dsw-radius-md);
  background: var(--dsw-alias-bg-layer-2);
}
.pa-rule[data-open] + .pa-rule {
  border-top-color: transparent;
}
.pa-rule__header {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.pa-rule__toggle {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  gap: 8px;
  min-width: 0;
  height: 36px;
  padding: 0 4px 0 6px;
  border: 0;
  border-radius: var(--dsw-radius-sm);
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
@media (hover: hover) {
  .pa-rule__toggle:hover {
    background: var(--dsw-alias-interactive-bg-hover);
  }
}
.pa-rule__toggle:focus-visible {
  outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
  outline-offset: -1px;
}
.pa-rule__dot {
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: transparent;
  box-shadow: inset 0 0 0 1.5px var(--dsw-alias-label-tertiary);
}
.pa-rule__dot[data-enabled='true'] {
  background: var(--dsw-alias-state-success-primary, #2f9e44);
  box-shadow: none;
}
.pa-rule[data-invalid] .pa-rule__dot {
  background: var(--dsw-alias-state-error-primary);
  box-shadow: none;
}
.pa-rule__name {
  flex: 0 0 auto;
  min-width: 0;
  max-width: 50%;
  overflow: hidden;
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pa-rule__name[data-empty] {
  color: var(--dsw-alias-label-tertiary);
  font-weight: 400;
}
.pa-rule[data-disabled] .pa-rule__name {
  color: var(--dsw-alias-label-secondary);
}
.pa-rule__preview {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pa-rule__preview[data-empty] {
  color: var(--dsw-alias-label-caption);
}
.pa-rule__preview[data-error] {
  color: var(--dsw-alias-state-error-primary);
}
.pa-rule__chevron {
  flex: none;
  width: 14px;
  height: 14px;
  color: var(--dsw-alias-label-tertiary);
  transition: transform 120ms ease;
}
.pa-rule[data-open] .pa-rule__chevron {
  transform: rotate(180deg);
}
.pa-rule__switch {
  flex: none;
  margin-right: 2px;
}
.pa-rule__body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 4px 10px 10px 22px;
}
.pa-rule__input {
  display: flex;
  box-sizing: border-box;
  width: 100%;
  background: var(--dsw-alias-bg-layer-3);
}
.pa-rule__textarea {
  min-height: 72px;
}
.pa-rule__footer {
  display: flex;
  align-items: center;
  margin-top: 2px;
}
.pa-settings__card .pa-rule__remove {
  color: var(--dsw-alias-state-error-primary);
}
@media (hover: hover) {
  .pa-settings__card .pa-rule__remove:hover:not(:disabled) {
    background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 10%, transparent);
  }
}
@media (max-width: 420px) {
  .pa-rule__name {
    max-width: 42%;
  }
  .pa-rule__body {
    padding-left: 10px;
  }
}
.pa-settings__fields {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.pa-settings__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.pa-settings__label {
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
  line-height: 20px;
}
.pa-settings__select {
  box-sizing: border-box;
  width: 100%;
  height: 32px;
  padding: 0 12px;
  border: 0.5px solid var(--dsw-alias-border-l4);
  border-radius: var(--dsw-radius-md);
  /* 与官方设置字段同色：bg-overlay 在深色主题里接近白，长时间阅读非常刺眼。 */
  background: var(--dsw-alias-bg-layer-3);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 13px;
}
.pa-settings__select:focus {
  border-color: var(--dsw-alias-state-business-primary);
  outline: none;
}
.pa-settings__select:disabled {
  color: var(--dsw-alias-label-caption);
}
.pa-settings__textarea {
  box-sizing: border-box;
  width: 100%;
  min-height: 56px;
  padding: 6px 12px;
  border: 0.5px solid var(--dsw-alias-border-l4);
  border-radius: var(--dsw-radius-md);
  /* 官方 ConfigField 的输入面：比卡片亮一档的深灰，不是浮层白。 */
  background: var(--dsw-alias-bg-layer-3);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 13px;
  line-height: 20px;
  resize: vertical;
}
.pa-settings__textarea:focus {
  border-color: var(--dsw-alias-state-business-primary);
  outline: none;
}
.pa-settings__editor {
  min-height: 260px;
  font-family: var(--dsw-font-family-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);
  font-size: 12px;
  line-height: 18px;
}
.pa-settings__pre {
  box-sizing: border-box;
  max-height: 320px;
  margin: 0;
  padding: 8px 12px;
  overflow: auto;
  border: 0.5px solid var(--dsw-alias-border-l4);
  border-radius: var(--dsw-radius-md);
  background: var(--dsw-alias-bg-layer-3);
  color: var(--dsw-alias-label-primary);
  font-family: var(--dsw-font-family-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);
  font-size: 12px;
  line-height: 18px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.pa-settings__pre ins {
  color: var(--dsw-alias-state-success-primary, #2f9e44);
  text-decoration: none;
  background: color-mix(in srgb, currentColor 12%, transparent);
}
.pa-settings__pre del {
  color: var(--dsw-alias-state-error-primary);
  text-decoration: line-through;
  background: color-mix(in srgb, currentColor 12%, transparent);
}
.pa-settings__diff-fold {
  color: var(--dsw-alias-label-tertiary);
}
.pa-settings__savebar {
  position: sticky;
  bottom: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  box-sizing: border-box;
  /* 长表单滚动时保存动作始终在手边；底色与面板一致，不额外画框。 */
  padding: 8px 12px;
  background: var(--dsw-alias-bg-base, transparent);
}
.pa-settings__savebar .pa-settings__error {
  margin-right: auto;
}
.pa-settings__history {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.pa-settings__history-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 0;
  border-top: 0.5px solid var(--dsw-alias-border-l1);
}
.pa-settings__history-item:first-child {
  padding-top: 0;
  border-top: 0;
}
.pa-settings__history-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}
.pa-settings__history-actions {
  display: flex;
  gap: 8px;
}
@media (max-width: 520px) {
  .pa-settings__body {
    padding: 8px 12px 12px;
  }
  .pa-settings__history-head {
    flex-direction: column;
    gap: 2px;
  }
}

/* ── 过滤条：官方 Pill / Input 只负责摆放 ───────────────────────────── */
.pa-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  flex: 0 0 auto;
  padding: 8px 16px;
}
.pa-toolbar__filters {
  display: flex;
  align-items: center;
  gap: 2px;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
}
.pa-toolbar__filters::-webkit-scrollbar {
  display: none;
}
.pa-toolbar__tools {
  display: flex;
  flex: 0 1 auto;
  align-items: center;
  gap: 4px;
  min-width: 0;
}
.pa-toolbar__search {
  flex: 0 1 auto;
  width: 180px;
  max-width: 200px;
  min-width: 120px;
  height: 28px;
  border-radius: var(--dsw-radius-sm);
}
/* 官方 Input 默认 14/32；工具条里收一档，与 24px 的 Pill 同一行不抢视线。 */
.pa-toolbar__search input {
  font-size: 13px;
  line-height: 18px;
}
.pa-toolbar__search svg {
  width: 14px;
  height: 14px;
}
.pa-toolbar__help {
  flex: 0 0 auto;
}
/* 下拉筛选：官方 Button 做触发，尾随一个箭头；两个下拉之间留一点呼吸。 */
.pa-filter-menu__trigger + .pa-filter-menu__trigger {
  margin-left: 6px;
}
.pa-filter-menu__value {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pa-filter-menu__chevron {
  display: inline-flex;
  flex: 0 0 auto;
  width: 14px;
  height: 14px;
  margin-left: 4px;
  color: var(--dsw-alias-label-tertiary);
}
.pa-help-text {
  margin: 0 0 8px;
  color: var(--dsw-alias-label-secondary);
  font-size: 13px;
  line-height: 20px;
}
.pa-help-text:last-of-type {
  margin-bottom: 0;
}
/* 双写类名，保证在宿主 Modal 样式之后加载时仍能给出适合说明文字的宽度。 */
.pa-help-dialog.pa-help-dialog {
  width: min(480px, 100%);
}

/* ── 列表：官方 AnimatedRows 容器 + 共用的列表行 ─────────────────────── */
.pa-list {
  position: relative;
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 2px;
  box-sizing: border-box;
  min-height: 0;
  margin: 0 16px 16px;
  padding: 4px;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  border: 0.5px solid var(--dsw-alias-border-l2);
  border-radius: var(--dsw-radius-lg);
  background: var(--dsw-alias-bg-layer-1);
}
.pa-row {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  box-sizing: border-box;
  min-width: 0;
  border-radius: var(--dsw-radius-md);
  transition: background-color 120ms ease;
}
@media (hover: hover) {
  .pa-row:hover {
    background: var(--dsw-alias-interactive-bg-hover);
  }
}
.pa-row__head {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  min-width: 0;
  padding: 10px 12px;
}
.pa-row__body {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.pa-row__titleline {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.pa-row__title {
  flex: 1 1 auto;
  min-width: 0;
  margin: 0;
  overflow: hidden;
  color: var(--dsw-alias-label-primary);
  font-size: 14px;
  font-weight: 500;
  line-height: 22px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pa-row__time {
  margin-left: auto;
  color: var(--dsw-alias-label-tertiary);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
/* 标题行里的时间：紧跟状态徽标，不再占满剩余宽度。 */
.pa-row__time--inline {
  margin-left: 0;
}
.pa-row__summary {
  margin: 0;
  overflow: hidden;
  color: var(--dsw-alias-label-secondary);
  font-size: 13px;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pa-row__footer {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 28px;
  margin-top: 2px;
  min-width: 0;
}
.pa-row__session {
  flex: 0 0 auto;
}
.pa-row__ref {
  flex: 0 0 auto;
}
.pa-row__aside {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 4px;
}
.pa-row__status {
  flex: 0 0 auto;
}
.pa-row__toggle {
  width: 28px;
  min-width: 28px;
  padding: 0;
  flex: 0 0 auto;
  color: var(--dsw-alias-label-tertiary);
}
.pa-row__toggle:hover:not(:disabled) {
  color: var(--dsw-alias-label-primary);
}
.pa-row__toggle svg {
  transition: transform 120ms ease;
}
.pa-row__toggle[aria-expanded='true'] svg {
  transform: rotate(180deg);
}
.pa-row__detail {
  min-width: 0;
  padding: 0 12px 12px;
}

/* ── 审批详情：官方没有的字段容器，材质与行一致 ─────────────────────── */
.pa-detail {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  padding-top: 8px;
  border-top: 0.5px solid var(--dsw-alias-border-l1);
}
.pa-detail__question {
  margin: 0;
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
  line-height: 20px;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}
.pa-detail__facts {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
}
.pa-detail__fact {
  flex: 0 0 auto;
}
.pa-detail__options {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.pa-detail__option {
  border: 0.5px solid transparent;
  border-radius: var(--dsw-radius-sm);
  transition: background-color 120ms ease, border-color 120ms ease;
}
@media (hover: hover) {
  .pa-detail__option:hover {
    background: var(--dsw-alias-interactive-bg-hover);
  }
}
.pa-detail__option[data-selected] {
  border-color: var(--dsw-alias-border-l2);
  background: var(--dsw-alias-interactive-bg-hover);
}
.pa-detail__option-button {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  width: 100%;
  min-width: 0;
  padding: 6px 8px;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.pa-detail__option-button:disabled {
  cursor: default;
}
.pa-detail__option-button:focus-visible {
  outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
  outline-offset: 1px;
  border-radius: inherit;
}
.pa-detail__option-seat,
.pa-detail__answer-seat,
.pa-detail__attachment-seat {
  display: grid;
  flex: 0 0 18px;
  place-items: center;
  width: 18px;
  height: 18px;
  margin-top: 1px;
  border-radius: var(--dsw-radius-xs);
  background: var(--dsw-alias-bg-overlay);
  color: var(--dsw-alias-label-secondary);
  font-size: 11px;
  font-weight: 500;
  line-height: 16px;
}
.pa-detail__option-copy {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.pa-detail__option-label {
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
  overflow-wrap: anywhere;
}
.pa-detail__option-desc {
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  line-height: 18px;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

/* 回答行与附件行：与选项行同高、同内边距、同文字起点。 */
.pa-detail__answer,
.pa-detail__attachments {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  width: 100%;
  padding: 6px 8px;
  border: 0.5px solid transparent;
  border-radius: var(--dsw-radius-sm);
}
.pa-detail__answer {
  transition: background-color 120ms ease, border-color 120ms ease;
}
.pa-detail__answer:focus-within,
.pa-detail__answer[data-active] {
  border-color: var(--dsw-alias-border-l2);
  background: var(--dsw-alias-interactive-bg-hover);
}
@media (hover: hover) {
  .pa-detail__answer:hover {
    background: var(--dsw-alias-interactive-bg-hover);
  }
}
.pa-detail__answer--readonly:hover {
  background: transparent;
}
.pa-detail__answer-field {
  display: grid;
  flex: 1;
  min-width: 0;
}
.pa-detail__answer-field > * {
  grid-area: 1 / 1;
  min-width: 0;
  padding: 0;
  font: inherit;
  font-size: 13px;
  line-height: 20px;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: anywhere;
}
.pa-detail__answer-mirror {
  box-sizing: content-box;
  max-height: 120px;
  overflow: hidden;
  visibility: hidden;
}
.pa-detail__answer-input {
  resize: none;
  overflow-y: auto;
  border: none;
  outline: none;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  caret-color: var(--dsw-alias-state-business-primary);
}
.pa-detail__answer-input::placeholder {
  color: var(--dsw-alias-label-caption);
}
.pa-detail__answer-text {
  flex: 1;
  min-width: 0;
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
  line-height: 20px;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}
.pa-detail__attachment-copy {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0 6px;
  min-width: 0;
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
  line-height: 20px;
}
.pa-detail__attachment-label {
  color: var(--dsw-alias-label-secondary);
}
.pa-detail__attachment-file {
  max-width: 100%;
  padding: 0;
  overflow: hidden;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}
.pa-detail__attachment-file:hover {
  color: var(--dsw-alias-state-business-primary);
  text-decoration: underline;
}
.pa-detail__attachment-file:focus-visible {
  outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
  outline-offset: 2px;
  border-radius: 2px;
}
.pa-detail__attachment-hint {
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  line-height: 18px;
}

/* ── 详情页脚 ───────────────────────────────────────────────────────── */
.pa-detail__footer {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 2px;
  padding-top: 8px;
  border-top: 0.5px solid var(--dsw-alias-border-l1);
}
.pa-detail__progress {
  flex: 0 0 auto;
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  line-height: 18px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.pa-detail__feedback {
  flex: 1;
  min-height: 18px;
  color: var(--dsw-alias-state-error-primary);
  font-size: 12px;
  line-height: 18px;
  text-align: right;
  overflow-wrap: anywhere;
}
.pa-detail__actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 8px;
}

/* ── 连接横幅与提交提示 ─────────────────────────────────────────────── */
.pa-banner {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 8px;
  margin: 0 16px 8px;
  padding: 6px 10px;
  border: 0.5px solid var(--dsw-alias-state-error-primary);
  border-radius: var(--dsw-radius-sm);
  color: var(--dsw-alias-state-error-primary);
  font-size: 12px;
  line-height: 18px;
}
.pa-banner__retry {
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-decoration: underline;
  cursor: pointer;
}
.pa-notice {
  margin: 0;
  padding: 0 16px 8px;
  color: var(--dsw-alias-state-business-primary);
  font-size: 12px;
  line-height: 18px;
}

/* ── 来源卡片与线程行 ───────────────────────────────────────────────── */
.pa-source__dot,
.pa-source__channel,
.pa-source__switch,
.pa-source__status {
  flex: 0 0 auto;
}
.pa-source__status {
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  line-height: 18px;
  white-space: nowrap;
}
.pa-source__threads-summary {
  flex: 0 0 auto;
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  line-height: 18px;
  white-space: nowrap;
}
.pa-source__threads {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.pa-thread {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 4px 6px;
  border-radius: var(--dsw-radius-sm);
}
@media (hover: hover) {
  .pa-thread:hover {
    background: var(--dsw-alias-interactive-bg-hover);
  }
}
.pa-thread__main {
  display: flex;
  flex: 1 1 auto;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}
.pa-thread__name {
  overflow: hidden;
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pa-thread__counts {
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  line-height: 18px;
  white-space: nowrap;
}
.pa-thread__time {
  margin-left: auto;
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  line-height: 18px;
  white-space: nowrap;
}
.pa-thread__switch {
  flex: 0 0 auto;
}
.pa-source__config {
  display: flex;
  gap: 6px;
  min-width: 0;
  margin: 8px 0 0;
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  line-height: 18px;
}
.pa-source__config-label {
  flex: 0 0 auto;
  color: var(--dsw-alias-label-tertiary);
}
.pa-source__config-value {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pa-source__error {
  margin: 8px 0 0;
  color: var(--dsw-alias-state-error-primary);
  font-size: 12px;
  line-height: 18px;
  overflow-wrap: anywhere;
}
.pa-source__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}
.pa-source__test {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 0.5px solid var(--dsw-alias-border-l1);
}
.pa-source__test-title {
  margin: 0 0 4px;
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  line-height: 18px;
}
.pa-source__test-empty {
  margin: 0;
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  line-height: 18px;
}
.pa-source__test-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

/* ── 事件卡片 ───────────────────────────────────────────────────────── */
.pa-signal {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  gap: 4px;
  box-sizing: border-box;
  min-width: 0;
  padding: 10px 12px;
  border-radius: var(--dsw-radius-md);
  transition: background-color 120ms ease;
}
@media (hover: hover) {
  .pa-signal:hover {
    background: var(--dsw-alias-interactive-bg-hover);
  }
}
.pa-signal__head {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.pa-signal__kind,
.pa-signal__verdict-tag,
.pa-signal__inferred {
  flex: 0 0 auto;
}
.pa-signal__source {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pa-signal__aside {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 6px;
  margin-left: auto;
}
.pa-signal__time {
  flex: 0 0 auto;
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  line-height: 18px;
  white-space: nowrap;
}
.pa-signal__text {
  display: -webkit-box;
  margin: 0;
  overflow: hidden;
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
  line-height: 20px;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  overflow-wrap: anywhere;
}
/*
 * 可点击的结局外套一层官方 Button；这里把按钮的盒子收成零，让尺寸完全由里面的
 * Tag 决定，与只读结局逐像素一致。
 */
.pa-signal__verdict.pa-signal__verdict {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  height: auto;
  min-width: 0;
  min-height: 0;
  padding: 0;
  border: 0;
  background: transparent;
}
.pa-signal__verdict.pa-signal__verdict:hover:not(:disabled) {
  background: transparent;
}
.pa-signal--compact {
  padding: 6px 8px;
}
.pa-signal--compact .pa-signal__text {
  -webkit-line-clamp: 2;
}
.pa-events__status {
  margin: 0;
  padding: 0 16px 8px;
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  line-height: 18px;
}
.pa-events__error {
  margin: 0;
  padding: 0 16px 8px;
  color: var(--dsw-alias-state-error-primary);
  font-size: 12px;
  line-height: 18px;
}

@media (max-width: 520px) {
  .pa-toolbar {
    align-items: stretch;
  }
  .pa-toolbar__tools {
    width: 100%;
  }
  .pa-toolbar__search {
    width: auto;
    max-width: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .pa-row,
  .pa-detail__option,
  .pa-detail__answer,
  .pa-row__toggle svg,
  .pa-console__tab,
  .pa-thread,
  .pa-signal {
    transition: none;
  }
}

/* ── 概览页 ─────────────────────────────────────────────────────────── */
.pa-overview {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 14px;
  box-sizing: border-box;
  min-height: 0;
  padding: 12px 16px 16px;
  overflow-y: auto;
  overscroll-behavior: contain;
}
.pa-overview__pulse {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
}
button.pa-overview__pulse {
  cursor: pointer;
}
.pa-overview__pulse:hover .pa-overview__pulse-label {
  color: var(--dsw-alias-label-primary);
}
.pa-overview__pulse:focus-visible {
  outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
  outline-offset: 2px;
  border-radius: 2px;
}
.pa-overview__pulse-copy {
  display: inline-flex;
  flex: 1 1 auto;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.pa-overview__pulse-dot {
  flex: 0 0 auto;
}
.pa-overview__pulse-label {
  overflow: hidden;
  color: var(--dsw-alias-label-secondary);
  font-size: 13px;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pa-overview__pulse-ago {
  flex: 0 0 auto;
  color: var(--dsw-alias-label-tertiary);
  font-size: 11px;
  line-height: 18px;
}

.pa-overview__attention {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  gap: 6px;
}
.pa-overview__attention-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  border: 0;
  border-radius: var(--dsw-radius-sm);
  background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 10%, var(--dsw-alias-bg-layer-1));
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.pa-overview__attention-row[data-severity='danger'] {
  background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 10%, var(--dsw-alias-bg-layer-1));
}
.pa-overview__attention-tag {
  flex: 0 0 auto;
  white-space: nowrap;
}
.pa-overview__attention-row:focus-visible {
  outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
  outline-offset: 2px;
}
.pa-overview__attention-main {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}
.pa-overview__attention-main > span:first-child {
  color: var(--dsw-alias-label-primary);
  font-size: 12px;
  line-height: 18px;
}
.pa-overview__attention-meta {
  color: var(--dsw-alias-label-tertiary);
  font-size: 10.5px;
  line-height: 16px;
}
.pa-overview__attention-arrow {
  flex: 0 0 auto;
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  line-height: 18px;
}
.pa-overview__attention-more {
  padding-left: 2px;
  color: var(--dsw-alias-label-tertiary);
  font-size: 10.5px;
  line-height: 16px;
}

.pa-overview__fleet {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  gap: 6px;
}
.pa-overview__fleet-head {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.pa-overview__fleet-title {
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
}
.pa-overview__fleet-count {
  color: var(--dsw-alias-label-primary);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  line-height: 18px;
}
.pa-overview__seats {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}
.pa-overview__seat {
  width: 12px;
  height: 4px;
  border-radius: 2px;
  background: var(--dsw-alias-border-l2);
}
.pa-overview__seat[data-state='running'] {
  background: var(--dsw-alias-state-business-primary);
}
.pa-overview__seat[data-state='blocked'] {
  background: var(--dsw-alias-state-warn-primary);
}
.pa-overview__capacity {
  position: relative;
  display: inline-flex;
  flex: 1 1 60px;
  max-width: 120px;
  height: 4px;
  overflow: hidden;
  border-radius: 2px;
  background: var(--dsw-alias-border-l2);
}
.pa-overview__capacity-fill {
  display: block;
  height: 100%;
  background: var(--dsw-alias-state-business-primary);
}
.pa-overview__queue {
  margin-left: auto;
  color: var(--dsw-alias-label-tertiary);
  font-size: 10.5px;
  line-height: 16px;
  white-space: nowrap;
}
.pa-overview__workers {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.pa-overview__worker {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
  padding: 6px 8px;
  border: 0;
  border-radius: var(--dsw-radius-sm);
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.pa-overview__worker:hover {
  background: var(--dsw-alias-interactive-bg-hover);
}
.pa-overview__worker:focus-visible {
  outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
  outline-offset: 2px;
}
.pa-overview__worker-head {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.pa-overview__worker-dot {
  flex: 0 0 auto;
}
.pa-overview__worker-title {
  flex: 1 1 auto;
  overflow: hidden;
  min-width: 0;
  color: var(--dsw-alias-label-primary);
  font-size: 12.5px;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pa-overview__worker-sub {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
  padding-left: 16px;
  color: var(--dsw-alias-label-tertiary);
  font-size: 10.5px;
  line-height: 16px;
}
.pa-overview__worker-sub > span:first-child {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pa-overview__worker-time {
  flex: 0 0 auto;
}
.pa-overview__worker-more {
  padding: 2px 8px 2px 24px;
  border: 0;
  background: transparent;
  color: var(--dsw-alias-label-tertiary);
  font: inherit;
  font-size: 10.5px;
  line-height: 16px;
  text-align: left;
  cursor: pointer;
}
.pa-overview__worker-more:hover {
  color: var(--dsw-alias-label-primary);
}
.pa-overview__empty-line {
  margin: 0;
  color: var(--dsw-alias-label-tertiary);
  font-size: 11px;
  line-height: 16px;
}

.pa-context {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 4px;
  color: var(--dsw-alias-label-tertiary);
  font-size: 9.5px;
  line-height: 16px;
  white-space: nowrap;
}
.pa-context__label {
  color: var(--dsw-alias-label-tertiary);
}
.pa-context__value {
  color: var(--dsw-alias-label-secondary);
  font-size: 10.5px;
  font-variant-numeric: tabular-nums;
}
.pa-context[data-level='warn'] .pa-context__value {
  color: var(--dsw-alias-state-warn-label);
}
.pa-context[data-level='critical'] .pa-context__value {
  color: var(--dsw-alias-state-error-primary);
}
.pa-context__ring {
  flex: 0 0 auto;
  width: 16px;
  height: 16px;
}

.pa-overview__today {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  gap: 8px;
}
.pa-overview__section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}
.pa-overview__section-title {
  margin: 0;
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
}
.pa-overview__section-side {
  color: var(--dsw-alias-label-tertiary);
  font-size: 10.5px;
  line-height: 16px;
}
.pa-overview__tiles {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  overflow: hidden;
  border: 0.5px solid var(--dsw-alias-border-l2);
  border-radius: var(--dsw-radius-sm);
  background: var(--dsw-alias-bg-layer-1);
}
.pa-overview__tile {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
  padding: 8px 10px;
  border-left: 0.5px solid var(--dsw-alias-border-l2);
}
.pa-overview__tile:first-child {
  border-left: 0;
}
.pa-overview__tile-label {
  color: var(--dsw-alias-label-tertiary);
  font-size: 9.5px;
  line-height: 14px;
}
.pa-overview__tile-value {
  color: var(--dsw-alias-label-primary);
  font-size: 18px;
  font-variant-numeric: tabular-nums;
  font-weight: 500;
  line-height: 24px;
}
.pa-overview__tile-sub {
  color: var(--dsw-alias-label-tertiary);
  font-size: 9.5px;
  line-height: 14px;
}
.pa-overview__tile-sub[data-failed='true'] {
  color: var(--dsw-alias-state-error-primary);
}

.pa-overview__chart {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  gap: 8px;
}
.pa-overview__chart-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.pa-overview__legend {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--dsw-alias-label-tertiary);
  font-size: 10.5px;
  line-height: 16px;
}
.pa-overview__legend-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  margin-left: 4px;
  border-radius: 50%;
  background: var(--dsw-alias-state-business-primary);
}
.pa-overview__legend-dot:first-child {
  margin-left: 0;
}
.pa-overview__legend-dot[data-kind='filtered'] {
  background: var(--dsw-alias-state-warn-primary);
}
.pa-overview__bars {
  display: flex;
  align-items: flex-end;
  gap: 7px;
  height: 54px;
  padding: 0 2px;
}
.pa-overview__bar-col {
  display: flex;
  flex: 1 1 0;
  flex-direction: column;
  justify-content: flex-end;
  gap: 1px;
  height: 100%;
  min-width: 0;
}
.pa-overview__bar {
  display: block;
  width: 100%;
  border-radius: 2px 2px 1px 1px;
  background: var(--dsw-alias-state-business-primary);
}
.pa-overview__bar[data-kind='filtered'] {
  background: var(--dsw-alias-state-warn-primary);
}
.pa-overview__bar[data-kind='empty'] {
  border-radius: 1px;
  background: var(--dsw-alias-border-l2);
}
.pa-overview__days {
  display: flex;
  gap: 7px;
  padding: 0 2px;
}
.pa-overview__day {
  flex: 1 1 0;
  overflow: hidden;
  min-width: 0;
  color: var(--dsw-alias-label-tertiary);
  font-size: 9.5px;
  line-height: 14px;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pa-overview__day[data-today='true'] {
  color: var(--dsw-alias-label-primary);
  font-weight: 500;
}

.pa-overview__footer {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 4px 12px;
  margin-top: auto;
  padding-top: 2px;
  color: var(--dsw-alias-label-tertiary);
  font-size: 10px;
  line-height: 15px;
}
.pa-overview__totals {
  min-width: 0;
}
.pa-overview__sources {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 0 8px;
}
.pa-overview__sources-error {
  color: var(--dsw-alias-state-error-primary);
}

.pa-overview__empty {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  margin: auto 0;
  padding: 16px 0;
}
.pa-overview__empty-title {
  margin: 0;
  color: var(--dsw-alias-label-primary);
  font-size: 14px;
  font-weight: 500;
  line-height: 22px;
}
.pa-overview__empty-body {
  margin: 0;
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  line-height: 18px;
}

.pa-overview__skeleton {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.pa-overview__skeleton-row,
.pa-overview__skeleton-tile {
  border-radius: var(--dsw-radius-sm);
  background: var(--dsw-alias-bg-skeleton);
}
.pa-overview__skeleton-row {
  height: 28px;
}
.pa-overview__skeleton-tile {
  height: 64px;
}

@media (max-width: 520px) {
  .pa-overview {
    gap: 12px;
    padding: 10px 12px 14px;
  }
  .pa-overview__pulse-ago {
    font-size: 10.5px;
  }
}

/* ── 工单详情：交接时间线（540px 右侧栏） ───────────────────────────── */
.pa-console__notice {
  flex: 0 0 auto;
  margin: 8px 16px 0;
  padding: 6px 9px;
  border: 0.5px solid var(--dsw-alias-state-warn-primary, #e0a24a);
  border-radius: var(--dsw-radius-sm);
  background: color-mix(in srgb, var(--dsw-alias-state-warn-primary, #e0a24a) 8%, transparent);
  color: var(--dsw-alias-state-warn-label, #d9b36c);
  font-size: 11px;
  line-height: 16px;
}

.pa-row--interactive {
  cursor: pointer;
  outline: none;
}
.pa-row--interactive:focus-visible {
  outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
  outline-offset: -1px;
}

.pa-ticket-detail {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 10px;
  box-sizing: border-box;
  min-height: 0;
  padding: 10px 14px 16px;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.pa-td__head {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
}
.pa-td__fallback-head {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  height: 20px;
}
.pa-td__topline {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 20px;
  min-width: 0;
}
.pa-td__back {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: 20px;
  min-width: 20px;
  height: 20px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 15px;
  line-height: 1;
  cursor: pointer;
}
.pa-td__back:hover {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}
.pa-td__back:focus-visible,
.pa-td__open:focus-visible,
.pa-td__retry:focus-visible,
.pa-chain__action:focus-visible {
  outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
  outline-offset: 1px;
}
.pa-td__ref {
  overflow: hidden;
  color: var(--dsw-alias-label-tertiary);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pa-td__ref b {
  color: var(--dsw-alias-label-secondary);
  font-family: var(--dsw-font-family-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);
  font-weight: 500;
  letter-spacing: 0.02em;
}
.pa-td__stage {
  flex: 0 0 auto;
}
.pa-td__spacer {
  flex: 1 1 auto;
}
.pa-td__open {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  height: 22px;
  padding: 0 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  box-shadow: inset 0 0 0 0.5px var(--dsw-alias-border-l2);
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 10.5px;
  line-height: 15px;
  white-space: nowrap;
  cursor: pointer;
}
.pa-td__open:hover:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}
.pa-td__open:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.pa-td__retry {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  height: 22px;
  padding: 0 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  box-shadow: inset 0 0 0 0.5px var(--dsw-alias-border-l2);
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 10.5px;
  line-height: 15px;
  cursor: pointer;
}
.pa-td__retry:hover {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}
.pa-td__retry--inline {
  flex: 0 0 auto;
  height: 20px;
  font-size: 10px;
}
.pa-td__title {
  overflow: hidden;
  margin: 0;
  color: var(--dsw-alias-label-primary);
  font-size: 15.5px;
  font-weight: 600;
  line-height: 22px;
  letter-spacing: 0.01em;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pa-td__meta {
  display: flex;
  align-items: center;
  gap: 0;
  overflow: hidden;
  color: var(--dsw-alias-label-tertiary);
  font-size: 11px;
  line-height: 17px;
  white-space: nowrap;
}
.pa-td__meta-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}
.pa-td__meta-item + .pa-td__meta-item::before {
  content: '·';
  margin: 0 6px;
  color: var(--dsw-alias-border-l3);
}
.pa-td__meta-item b {
  color: var(--dsw-alias-label-secondary);
  font-family: var(--dsw-font-family-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);
  font-size: 10.5px;
  font-weight: 500;
}
.pa-td__notice {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 8px;
  border: 0.5px solid var(--dsw-alias-state-warn-primary, #e0a24a);
  border-radius: var(--dsw-radius-sm);
  background: color-mix(in srgb, var(--dsw-alias-state-warn-primary, #e0a24a) 8%, transparent);
  color: var(--dsw-alias-state-warn-label, #d9b36c);
  font-size: 10.5px;
  line-height: 15px;
}
.pa-td__notice span {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}
.pa-td__state {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 8px;
  padding: 24px 4px;
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  line-height: 18px;
}
.pa-td__state--error {
  color: var(--dsw-alias-state-error-primary);
}
.pa-td__state-title {
  margin: 0;
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
  font-weight: 500;
}
.pa-td__state-body {
  margin: 0;
  overflow-wrap: anywhere;
  color: var(--dsw-alias-label-secondary);
  font-size: 11px;
  line-height: 17px;
}

.pa-timeline {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  gap: 8px;
  box-sizing: border-box;
  min-width: 0;
  padding: 10px 12px;
  border: 0.5px solid var(--dsw-alias-border-l2);
  border-radius: 12px;
  background: var(--dsw-alias-bg-layer-1);
}
.pa-timeline__head {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 22px;
  min-width: 0;
}
.pa-timeline__title {
  flex: 0 0 auto;
  color: var(--dsw-alias-label-secondary);
  font-size: 12.5px;
  font-weight: 600;
  letter-spacing: 0.02em;
  white-space: nowrap;
}
.pa-timeline__view {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 1px;
  box-sizing: border-box;
  height: 20px;
  padding: 1px;
  border: 0.5px solid var(--dsw-alias-border-l1);
  border-radius: 6px;
  background: var(--dsw-alias-bg-layer-2);
}
.pa-timeline__view-tab {
  box-sizing: border-box;
  height: 17px;
  padding: 0 6px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--dsw-alias-label-tertiary);
  font: inherit;
  font-size: 10px;
  line-height: 17px;
  white-space: nowrap;
  cursor: pointer;
}
.pa-timeline__view-tab:hover {
  color: var(--dsw-alias-label-primary);
}
.pa-timeline__view-tab[aria-selected='true'] {
  background: var(--dsw-alias-bg-layer-3);
  color: var(--dsw-alias-label-primary);
}
.pa-timeline__view-tab:focus-visible {
  outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
  outline-offset: -1px;
}
.pa-timeline__spacer {
  flex: 1 1 auto;
  min-width: 4px;
}
.pa-timeline__focus {
  overflow: hidden;
  max-width: 118px;
  padding: 0 6px;
  border: 0.5px solid color-mix(in srgb, var(--dsw-alias-state-business-primary) 24%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--dsw-alias-state-business-primary) 10%, transparent);
  color: var(--dsw-alias-state-business-primary);
  font: inherit;
  font-size: 9.5px;
  line-height: 15px;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}
.pa-timeline__meta {
  flex: 0 1 auto;
  overflow: hidden;
  color: var(--dsw-alias-label-tertiary);
  font-size: 10.5px;
  font-variant-numeric: tabular-nums;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pa-timeline__origin {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  padding: 1px 1px 2px;
  color: var(--dsw-alias-label-tertiary);
  font-size: 11px;
}
.pa-timeline__origin-kind {
  flex: 0 0 auto;
  padding: 0 4px;
  border: 0.5px solid color-mix(in srgb, var(--dsw-alias-state-business-primary) 26%, transparent);
  border-radius: 4px;
  background: color-mix(in srgb, var(--dsw-alias-state-business-primary) 12%, transparent);
  color: color-mix(in srgb, var(--dsw-alias-state-business-primary) 72%, var(--dsw-alias-label-primary));
  font-size: 9.5px;
  font-weight: 600;
  line-height: 15px;
}
.pa-timeline__origin-text {
  overflow: hidden;
  min-width: 0;
  color: var(--dsw-alias-label-secondary);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pa-timeline__origin-time {
  flex: 0 0 auto;
  margin-left: auto;
  color: var(--dsw-alias-label-tertiary);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.pa-timeline__banner {
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 10px;
  line-height: 15px;
}
.pa-timeline__banner--unavailable {
  border: 0.5px solid color-mix(in srgb, var(--dsw-alias-state-warn-primary, #e0a24a) 28%, transparent);
  background: color-mix(in srgb, var(--dsw-alias-state-warn-primary, #e0a24a) 8%, transparent);
  color: var(--dsw-alias-state-warn-label, #d9b36c);
}
.pa-timeline__banner--partial {
  border: 0.5px solid color-mix(in srgb, var(--dsw-alias-state-business-primary) 24%, transparent);
  background: color-mix(in srgb, var(--dsw-alias-state-business-primary) 8%, transparent);
  color: var(--dsw-alias-label-secondary);
}
.pa-timeline__empty {
  padding: 12px 4px;
  color: var(--dsw-alias-label-tertiary);
  font-size: 10.5px;
  line-height: 16px;
  text-align: center;
}
.pa-timeline__legend {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 10px;
  padding-top: 1px;
  color: var(--dsw-alias-label-caption);
  font-size: 9px;
  line-height: 14px;
}
.pa-timeline__legend span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.pa-timeline__legend-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--dsw-alias-label-tertiary);
}
.pa-timeline__legend-line {
  width: 10px;
  height: 1.5px;
  border-radius: 1px;
  background: var(--dsw-alias-label-tertiary);
}

.pa-swim {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.pa-swim__scroll {
  min-width: 0;
}
.pa-swim--wide .pa-swim__scroll {
  overflow-x: auto;
  scrollbar-width: thin;
}
.pa-swim__inner {
  box-sizing: border-box;
  width: 100%;
}
.pa-swim__rows {
  display: flex;
  flex-direction: column;
  width: 100%;
  min-width: 0;
}
.pa-swim__newrows {
  position: sticky;
  bottom: 8px;
  align-self: center;
  margin-top: 2px;
  padding: 2px 8px;
  border: 0.5px solid color-mix(in srgb, var(--dsw-alias-state-business-primary) 32%, transparent);
  border-radius: 999px;
  background: var(--dsw-alias-bg-layer-3);
  color: var(--dsw-alias-state-business-primary);
  font: inherit;
  font-size: 10px;
  line-height: 16px;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.28);
}

.pa-lanes {
  position: sticky;
  top: 0;
  z-index: 6;
  display: flex;
  flex: 0 0 auto;
  height: 40px;
  overflow: visible;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1);
}
.pa-lanes--compact {
  height: 32px;
}
.pa-lane {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  box-sizing: border-box;
  min-width: 0;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  cursor: pointer;
}
.pa-lane:hover {
  background: color-mix(in srgb, var(--dsw-alias-label-primary) 4%, transparent);
}
.pa-lane:focus-visible {
  outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
  outline-offset: -1px;
}
.pa-lane__name {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  overflow: hidden;
  max-width: 100%;
  padding: 0 1px;
  color: inherit;
  font-family: var(--dsw-font-family-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);
  font-size: 10px;
  font-weight: 500;
  line-height: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pa-lane__dot {
  flex: 0 0 auto;
  width: 4px;
  height: 4px;
  border-radius: 50%;
}
.pa-lane__role {
  overflow: hidden;
  max-width: 100%;
  color: var(--dsw-alias-label-caption);
  font-size: 9px;
  line-height: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pa-lane--focused {
  background: color-mix(in srgb, var(--dsw-alias-state-business-primary) 10%, transparent);
  box-shadow: inset 0 0 0 0.5px color-mix(in srgb, var(--dsw-alias-state-business-primary) 36%, transparent);
}
.pa-lane--focused .pa-lane__name {
  color: var(--dsw-alias-label-primary);
}
.pa-lane--dim {
  opacity: 0.3;
}
.pa-lane--more {
  border-left: 1px dashed var(--dsw-alias-border-l2);
}
.pa-lane--more .pa-lane__name {
  color: var(--dsw-alias-label-tertiary);
}

.pa-chain {
  --pa-kind: var(--dsw-alias-label-tertiary);
  border-bottom: 1px solid color-mix(in srgb, var(--dsw-alias-border-l1) 55%, transparent);
  border-radius: 6px;
}
.pa-chain:last-child {
  border-bottom: 0;
}
.pa-chain--selected {
  background: color-mix(in srgb, var(--dsw-alias-state-business-primary) 7.5%, transparent);
  box-shadow: inset 0 0 0 0.5px color-mix(in srgb, var(--dsw-alias-state-business-primary) 36%, transparent);
}
.pa-chain--affected {
  background: linear-gradient(90deg, color-mix(in srgb, var(--dsw-alias-state-business-primary) 7%, transparent), transparent 78%);
}
.pa-chain--affected .pa-chain__meta::before {
  content: '';
  flex: 0 0 2px;
  align-self: stretch;
  margin: 6px 0;
  border-radius: 2px;
  background: color-mix(in srgb, var(--dsw-alias-state-business-primary) 55%, transparent);
}
.pa-chain--dim {
  opacity: 0.26;
}
.pa-chain--expandable .pa-chain__row {
  cursor: pointer;
}
.pa-chain__row {
  display: grid;
  grid-template-columns: var(--pa-rail-w) minmax(0, 1fr);
  align-items: stretch;
  box-sizing: border-box;
  width: 100%;
  min-height: 32px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  transition: background-color 120ms ease;
}
.pa-chain__row:hover {
  background: color-mix(in srgb, var(--dsw-alias-label-primary) 3%, transparent);
}
.pa-chain__row--static,
.pa-chain__row--live {
  cursor: default;
}
.pa-chain__row:focus-visible {
  outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
  outline-offset: -1px;
}
.pa-chain--fan .pa-chain__row {
  min-height: 46px;
}
.pa-chain--milestone .pa-chain__row {
  min-height: 26px;
}
.pa-chain--live .pa-chain__row {
  min-height: 30px;
}
.pa-chain__rail {
  position: relative;
  display: block;
  min-width: 0;
  min-height: 0;
}
.pa-chain__rail svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
}
.pa-chain__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding-left: 10px;
  border-left: 1px solid color-mix(in srgb, var(--dsw-alias-label-primary) 4.5%, transparent);
}
.pa-chain__kind {
  flex: 0 0 auto;
  padding: 0 5px;
  border: 0.5px solid color-mix(in srgb, var(--pa-kind) 34%, transparent);
  border-radius: 4px;
  background: color-mix(in srgb, var(--pa-kind) 12%, transparent);
  color: var(--pa-kind);
  font-size: 10px;
  line-height: 17px;
  height: 18px;
  white-space: nowrap;
}
.pa-chain__time {
  flex: 0 0 auto;
  margin-left: auto;
  color: var(--dsw-alias-label-tertiary);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.pa-chain--milestone .pa-chain__kind,
.pa-chain--live .pa-chain__kind {
  color: var(--dsw-alias-label-secondary);
  border-color: var(--dsw-alias-border-l2);
  background: color-mix(in srgb, var(--dsw-alias-label-primary) 4%, transparent);
}
.pa-chain--milestone.pa-kind-fail .pa-chain__kind {
  color: #ff9b9b;
  border-color: color-mix(in srgb, #ff6b6b 35%, transparent);
  background: color-mix(in srgb, #ff6b6b 9%, transparent);
}
.pa-kind-intervene .pa-chain__kind,
.pa-kind-intervene .pa-stream__kind {
  border-style: dashed;
}
.pa-chain--live .pa-chain__meta {
  border-left-color: transparent;
}
.pa-chain--live .pa-chain__time {
  color: var(--dsw-alias-label-caption);
}

.pa-chain__expand {
  margin: 2px 0 7px;
  padding: 9px 12px 11px;
  border: 0.5px solid var(--dsw-alias-border-l2);
  border-left: 2px solid var(--pa-kind);
  border-radius: 0 8px 8px 0;
  background: var(--dsw-alias-bg-layer-2);
}
.pa-chain__expand-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  color: var(--dsw-alias-label-tertiary);
  font-size: 10.5px;
  line-height: 16px;
}
.pa-chain__who {
  overflow: hidden;
  color: var(--dsw-alias-label-secondary);
  font-family: var(--dsw-font-family-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pa-chain__arrow {
  color: var(--dsw-alias-label-caption);
  font-size: 10px;
}
.pa-chain__etime {
  color: var(--dsw-alias-label-caption);
  font-variant-numeric: tabular-nums;
}
.pa-chain__quote {
  margin: 7px 0 0;
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  line-height: 18px;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}
.pa-chain__quote p {
  margin: 0;
}
.pa-chain__targets {
  margin: 4px 0 0;
  padding-left: 16px;
  color: var(--dsw-alias-label-secondary);
  font-size: 10.5px;
  line-height: 17px;
}
.pa-chain__options {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  margin-top: 7px;
}
.pa-chain__options-label {
  color: var(--dsw-alias-label-tertiary);
  font-size: 9.5px;
}
.pa-chain__option {
  padding: 0 5px;
  border: 0.5px solid var(--dsw-alias-border-l2);
  border-radius: 4px;
  color: var(--dsw-alias-label-secondary);
  font-size: 9.5px;
  line-height: 15px;
}
.pa-chain__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 9px;
}
.pa-chain__action {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  height: 22px;
  padding: 0 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  box-shadow: inset 0 0 0 0.5px var(--dsw-alias-border-l2);
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 10.5px;
  line-height: 15px;
  white-space: nowrap;
  cursor: pointer;
}
.pa-chain__action:hover {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}

.pa-live__text {
  overflow: hidden;
  min-width: 0;
  color: color-mix(in srgb, var(--dsw-alias-state-success-primary) 72%, var(--dsw-alias-label-primary));
  font-size: 10.5px;
  line-height: 17px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pa-live__rotator {
  position: relative;
  flex: 1;
  min-width: 0;
  height: 17px;
  overflow: hidden;
}
.pa-live__track {
  display: flex;
  flex-direction: column;
  transition: transform 420ms ease;
}
.pa-live__item {
  display: block;
  height: 17px;
  overflow: hidden;
  color: color-mix(in srgb, var(--dsw-alias-state-success-primary) 72%, var(--dsw-alias-label-primary));
  font-size: 10.5px;
  line-height: 17px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
@media (prefers-reduced-motion: reduce) {
  .pa-live__track {
    transition: none;
  }
}

.pa-rail__lane {
  stroke: color-mix(in srgb, var(--dsw-alias-label-primary) 6%, transparent);
  stroke-width: 1;
}
.pa-rail__edge {
  fill: none;
  stroke-width: 1.3;
  opacity: 0.9;
}
.pa-rail__source {
  stroke: var(--dsw-alias-bg-layer-1);
  stroke-width: 1.2;
}
.pa-rail__node {
  fill: var(--dsw-alias-bg-layer-1);
  stroke: var(--pa-kind);
  stroke-width: 1.4;
}
.pa-rail__node--dashed {
  stroke-dasharray: 2.5 2.5;
}
.pa-rail__milestone {
  fill: none;
  stroke: var(--dsw-alias-label-tertiary);
  stroke-width: 1.2;
}
.pa-rail__live-core {
  fill: var(--dsw-alias-state-success-primary);
}
.pa-rail__live-ring {
  fill: none;
  stroke: color-mix(in srgb, var(--dsw-alias-state-success-primary) 50%, transparent);
  stroke-width: 1;
  animation: pa-pulse 2s ease-out infinite;
  transform-origin: center;
}
@keyframes pa-pulse {
  0% {
    opacity: 0.9;
  }
  70%,
  100% {
    opacity: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .pa-rail__live-ring {
    animation: none;
  }
}

.pa-kind-dispatch {
  --pa-kind: #8b7bff;
}
.pa-kind-supplement {
  --pa-kind: #4fb8d9;
}
.pa-kind-spawn {
  --pa-kind: #a98bff;
}
.pa-kind-up {
  --pa-kind: #3fb9a1;
}
.pa-kind-sync {
  --pa-kind: #8a93a6;
}
.pa-kind-approval {
  --pa-kind: #e0a24a;
}
.pa-kind-decision {
  --pa-kind: #4fc38a;
}
.pa-kind-intervene {
  --pa-kind: #b9c1d1;
}
.pa-kind-state {
  --pa-kind: #8a8a92;
}
.pa-kind-fail {
  --pa-kind: #ff6b6b;
}

.pa-stream {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.pa-stream__row-wrap {
  border-bottom: 1px solid color-mix(in srgb, var(--dsw-alias-border-l1) 55%, transparent);
}
.pa-stream__row-wrap:last-child {
  border-bottom: 0;
}
.pa-stream__row {
  display: grid;
  grid-template-columns: 40px 44px 118px minmax(0, 1fr);
  gap: 6px;
  align-items: center;
  box-sizing: border-box;
  width: 100%;
  min-height: 36px;
  padding: 0 2px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.pa-stream__row:hover {
  background: color-mix(in srgb, var(--dsw-alias-label-primary) 3%, transparent);
}
.pa-stream__row:focus-visible {
  outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
  outline-offset: -1px;
}
.pa-stream__row--selected {
  background: color-mix(in srgb, var(--dsw-alias-state-business-primary) 7%, transparent);
  box-shadow: inset 0 0 0 0.5px color-mix(in srgb, var(--dsw-alias-state-business-primary) 30%, transparent);
}
.pa-stream__time {
  color: var(--dsw-alias-label-tertiary);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.pa-stream__kind {
  justify-self: start;
  padding: 0 5px;
  border: 0.5px solid color-mix(in srgb, var(--pa-kind) 34%, transparent);
  border-radius: 4px;
  background: color-mix(in srgb, var(--pa-kind) 12%, transparent);
  color: var(--pa-kind);
  font-size: 10px;
  line-height: 17px;
  white-space: nowrap;
}
.pa-stream__flow {
  overflow: hidden;
  color: var(--dsw-alias-label-tertiary);
  font-size: 10.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pa-stream__flow b {
  color: var(--dsw-alias-label-secondary);
  font-family: var(--dsw-font-family-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);
  font-weight: 500;
}
.pa-stream__arrow {
  margin: 0 3px;
  color: var(--dsw-alias-label-caption);
}
.pa-stream__summary {
  overflow: hidden;
  color: var(--dsw-alias-label-secondary);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pa-stream__expand {
  margin: 0 2px 6px;
  padding: 8px 10px 10px;
  border: 0.5px solid var(--dsw-alias-border-l2);
  border-left: 2px solid var(--pa-kind);
  border-radius: 0 8px 8px 0;
  background: var(--dsw-alias-bg-layer-2);
}

.pa-fold {
  flex: 0 0 auto;
  overflow: hidden;
  border: 0.5px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  background: color-mix(in srgb, var(--dsw-alias-label-primary) 1.6%, transparent);
}
.pa-fold__button {
  display: flex;
  align-items: center;
  gap: 6px;
  box-sizing: border-box;
  width: 100%;
  height: 30px;
  padding: 0 9px;
  border: 0;
  background: transparent;
  color: var(--dsw-alias-label-tertiary);
  font: inherit;
  font-size: 11px;
  text-align: left;
  cursor: pointer;
}
.pa-fold__button:hover {
  background: color-mix(in srgb, var(--dsw-alias-label-primary) 2.5%, transparent);
}
.pa-fold__button:focus-visible {
  outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
  outline-offset: -1px;
}
.pa-fold__caret {
  color: var(--dsw-alias-label-caption);
  font-size: 9px;
  transition: transform 120ms ease;
}
.pa-fold--open .pa-fold__caret {
  transform: rotate(90deg);
}
.pa-fold__title {
  flex: 0 0 auto;
  color: var(--dsw-alias-label-secondary);
  font-weight: 500;
}
.pa-fold__sub {
  flex: 0 1 auto;
  overflow: hidden;
  color: var(--dsw-alias-label-caption);
  font-size: 9.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pa-fold__spacer {
  flex: 1 1 auto;
}
.pa-fold__meta {
  flex: 0 0 auto;
  color: var(--dsw-alias-label-caption);
  font-family: var(--dsw-font-family-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);
  font-size: 9.5px;
  white-space: nowrap;
}
.pa-fold__body {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 2px 10px 10px;
  border-top: 0.5px solid var(--dsw-alias-border-l1);
}
.pa-fold__kv {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 5px;
}
.pa-fold__key {
  color: var(--dsw-alias-label-tertiary);
  font-size: 10px;
  letter-spacing: 0.04em;
}
.pa-fold__value {
  color: var(--dsw-alias-label-secondary);
  font-size: 11.5px;
  line-height: 18px;
  overflow-wrap: anywhere;
}
.pa-fold__value--muted {
  color: var(--dsw-alias-label-tertiary);
}
.pa-fold__report {
  margin: 0;
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  line-height: 18px;
  overflow-wrap: anywhere;
}
.pa-fold__report p {
  margin: 0 0 6px;
}
.pa-fold__report p:last-child {
  margin-bottom: 0;
}
.pa-fold__report ul,
.pa-fold__report ol {
  margin: 4px 0;
  padding-left: 18px;
}
.pa-fold__report code {
  padding: 0 3px;
  border-radius: 3px;
  background: var(--dsw-alias-bg-layer-2);
  font-family: var(--dsw-font-family-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);
  font-size: 11px;
}

.pa-tiles {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1px;
  margin-top: 9px;
  padding-top: 8px;
  border-top: 0.5px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-border-l1);
}
.pa-tile {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
  padding: 0 2px;
  background: var(--dsw-alias-bg-layer-1);
}
.pa-tile__value {
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}
.pa-tile__label {
  color: var(--dsw-alias-label-tertiary);
  font-size: 9.5px;
}
`
