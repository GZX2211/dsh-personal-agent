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
/* ── 工单详情（几何与行解剖照 mockup：rail 96px，lane x = 12 + 16i） ─────── */

.pa-detail {
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: 100%;
  min-width: 0;
  overflow-y: auto;
  padding: 2px 0 14px;
}

.pa-detail--empty {
  gap: 8px;
  padding: 4px 0;
}

.pa-detail__placeholder {
  margin: 8px 0 0;
  font-size: 11.5px;
  line-height: 17px;
  color: var(--dsw-alias-label-tertiary);
}

/* 头部 */
.pa-detail__head {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.pa-detail__top {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 20px;
}

.pa-detail__back {
  width: 20px;
  height: 20px;
  min-width: 20px;
  padding: 0;
  border-radius: 6px;
  font-size: 14px;
  line-height: 1;
  color: var(--dsw-alias-label-secondary);
}

.pa-detail__code {
  font-size: 11px;
  color: var(--dsw-alias-label-tertiary);
}

.pa-detail__code b {
  font-family: var(--dsw-font-family-mono);
  font-weight: 500;
  letter-spacing: 0.02em;
  color: var(--dsw-alias-label-secondary);
}

.pa-detail__spacer {
  flex: 1;
}

.pa-detail__title {
  margin: 0;
  font-size: 15.5px;
  line-height: 22px;
  font-weight: 600;
  letter-spacing: 0.01em;
  color: var(--dsw-alias-label-primary);
  overflow-wrap: anywhere;
}

.pa-detail__meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0;
  font-size: 10.5px;
  color: var(--dsw-alias-label-tertiary);
}

.pa-detail__meta > span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}

.pa-detail__meta > span + span::before {
  content: '·';
  margin: 0 6px;
  color: var(--dsw-alias-label-tertiary);
  opacity: 0.55;
}

.pa-detail__meta b {
  font-family: var(--dsw-font-family-mono);
  font-size: 10px;
  font-weight: 500;
  color: var(--dsw-alias-label-secondary);
}

/* 卡片 */
.pa-card {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px 12px;
  background: var(--dsw-alias-bg-layer-1);
  border: 0.5px solid var(--dsw-alias-border-l1);
  border-radius: var(--dsw-radius-lg);
  min-width: 0;
}

.pa-card__head {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 18px;
}

.pa-card__title {
  margin: 0;
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: 0.03em;
  color: var(--dsw-alias-label-secondary);
}

.pa-card__meta {
  font-size: 10px;
  color: var(--dsw-alias-label-tertiary);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.pa-seg {
  display: inline-flex;
  align-items: center;
  gap: 1px;
  margin-left: 2px;
  padding: 1px;
  background: var(--dsw-alias-bg-layer-2);
  border: 0.5px solid var(--dsw-alias-border-l1);
  border-radius: 6px;
}

.pa-seg__item {
  padding: 0 6px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  font-size: 10px;
  line-height: 14px;
  color: var(--dsw-alias-label-tertiary);
}

.pa-seg__item--active {
  background: var(--dsw-alias-bg-layer-3);
  color: var(--dsw-alias-label-primary);
}

.pa-seg__item--disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

/* 来源条 */
.pa-origin {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-left: 2px;
  padding: 1px 0 1px 9px;
  border-left: 2px solid var(--dsw-alias-border-l3);
  min-width: 0;
}

.pa-origin__top {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  min-width: 0;
}

.pa-origin__kind {
  flex: 0 0 auto;
  padding: 0 4px;
  border: 0.5px solid color-mix(in srgb, var(--dsw-alias-state-business-primary) 26%, transparent);
  border-radius: 4px;
  background: color-mix(in srgb, var(--dsw-alias-state-business-primary) 12%, transparent);
  font-size: 9px;
  font-weight: 600;
  line-height: 14px;
  color: var(--dsw-alias-state-business-primary);
}

.pa-origin__text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--dsw-alias-label-secondary);
}

.pa-origin__sub {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 10.5px;
  color: var(--dsw-alias-label-tertiary);
}

.pa-origin__sub b {
  font-weight: 500;
  color: var(--dsw-alias-label-secondary);
}

/* 时间：一律靠右、等宽数字 */
.pa-time {
  margin-left: auto;
  padding-left: 8px;
  font-size: 9.5px;
  color: var(--dsw-alias-label-tertiary);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

/* 团队 chips */
.pa-team {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.pa-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 20px;
  padding: 0 6px 0 3px;
  border: 0.5px solid var(--dsw-alias-border-l1);
  border-radius: 6px;
  background: var(--dsw-alias-bg-layer-2);
  font-size: 9.5px;
  line-height: 18px;
  color: var(--dsw-alias-label-tertiary);
}

.pa-chip__index {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 13px;
  height: 13px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: var(--c, var(--dsw-alias-label-tertiary));
  color: var(--dsw-alias-bg-base);
  font-size: 8px;
  font-weight: 700;
}

.pa-chip__name {
  font-family: var(--dsw-font-family-mono);
  font-size: 9.5px;
  font-weight: 500;
  color: var(--dsw-alias-label-primary);
  max-width: 84px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pa-chip__state {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 9px;
  color: var(--dsw-alias-label-tertiary);
  white-space: nowrap;
}

.pa-chip__state::before {
  content: '';
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--dsw-alias-label-tertiary);
  opacity: 0.6;
}

.pa-chip__state[data-state='running'] {
  color: var(--dsw-alias-state-business-primary);
}

.pa-chip__state[data-state='running']::before {
  background: var(--dsw-alias-state-business-primary);
  opacity: 1;
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--dsw-alias-state-business-primary) 18%, transparent);
}

.pa-chip__state[data-state='done'] {
  font-size: 0;
  gap: 0;
}

.pa-chip__state[data-state='done']::before {
  background: var(--dsw-alias-state-success-primary);
  opacity: 1;
}

/* 图 */
.pa-graph {
  display: flex;
  flex-direction: column;
  margin-top: 2px;
  min-width: 0;
}

.pa-graph__row-wrap {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.pa-graph__row {
  display: grid;
  grid-template-columns: 96px minmax(0, 1fr);
  align-items: stretch;
  border-radius: 7px;
  transition: background 0.12s ease;
}

.pa-graph__row:hover {
  background: var(--dsw-alias-interactive-bg-hover);
}

.pa-graph__row--dim {
  opacity: 0.4;
}

.pa-graph__row--sel {
  background: color-mix(in srgb, var(--dsw-alias-state-business-primary) 8%, transparent);
  box-shadow: inset 0 0 0 0.5px color-mix(in srgb, var(--dsw-alias-state-business-primary) 42%, transparent);
}

.pa-graph__row--sel .pa-graph__sum {
  color: var(--dsw-alias-label-primary);
}

.pa-rail {
  position: relative;
  width: 96px;
}

.pa-rail svg {
  position: absolute;
  inset: 0;
  overflow: visible;
}

.pa-graph__txt {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
  padding: 2px 4px 2px 8px;
}

.pa-graph__hit {
  display: block;
  width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
  border-radius: 7px;
}

.pa-graph__hit:focus-visible {
  outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
  outline-offset: -2px;
}

.pa-hop-top {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 10.5px;
  line-height: 16px;
  color: var(--dsw-alias-label-tertiary);
  min-width: 0;
}

.pa-who {
  font-family: var(--dsw-font-family-mono);
  font-size: 10px;
  font-weight: 500;
  color: var(--c, var(--dsw-alias-label-secondary));
  white-space: nowrap;
}

.pa-arw {
  font-size: 10px;
  color: var(--dsw-alias-label-tertiary);
  opacity: 0.6;
}

.pa-kind {
  flex: 0 0 auto;
  padding: 0 5px;
  border: 0.5px solid var(--dsw-alias-border-l2);
  border-radius: 4px;
  background: var(--dsw-alias-bg-layer-3);
  font-size: 9px;
  line-height: 14px;
  color: var(--dsw-alias-label-secondary);
  white-space: nowrap;
}

.pa-kind--sp {
  border-color: color-mix(in srgb, var(--dsw-alias-state-business-primary) 28%, transparent);
  background: color-mix(in srgb, var(--dsw-alias-state-business-primary) 13%, transparent);
  color: var(--dsw-alias-state-business-primary);
}

.pa-kind--up {
  border-color: color-mix(in srgb, var(--dsw-alias-state-success-primary) 26%, transparent);
  background: color-mix(in srgb, var(--dsw-alias-state-success-primary) 12%, transparent);
  color: var(--dsw-alias-state-success-primary);
}

.pa-kind--ok {
  border-color: color-mix(in srgb, var(--dsw-alias-state-success-primary) 26%, transparent);
  background: color-mix(in srgb, var(--dsw-alias-state-success-primary) 12%, transparent);
  color: var(--dsw-alias-state-success-primary);
}

.pa-kind--warn {
  border-color: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 30%, transparent);
  background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 14%, transparent);
  color: var(--dsw-alias-state-warn-label);
}

.pa-kind--err {
  border-color: color-mix(in srgb, var(--dsw-alias-state-error-primary) 30%, transparent);
  background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 13%, transparent);
  color: var(--dsw-alias-state-error-primary);
}

.pa-impact {
  flex: 0 0 auto;
  padding: 0 4px;
  border: 0.5px solid color-mix(in srgb, var(--dsw-alias-state-business-primary) 24%, transparent);
  border-radius: 4px;
  background: color-mix(in srgb, var(--dsw-alias-state-business-primary) 10%, transparent);
  font-size: 9px;
  line-height: 14px;
  color: var(--dsw-alias-state-business-primary);
  white-space: nowrap;
}

.pa-graph__sum {
  font-size: 11.5px;
  line-height: 17px;
  color: var(--dsw-alias-label-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 里程碑行 */
.pa-ms {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10.5px;
  line-height: 16px;
  color: var(--dsw-alias-label-secondary);
  min-width: 0;
}

.pa-ms__dot {
  width: 5px;
  height: 5px;
  flex: 0 0 auto;
  border: 1px solid var(--dsw-alias-label-tertiary);
  border-radius: 50%;
}

.pa-ms__label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pa-ms__mono {
  font-family: var(--dsw-font-family-mono);
  font-size: 9.5px;
  color: var(--dsw-alias-label-tertiary);
}

/* 等待行：不是一条投递，是这个工单此刻卡在哪 */
.pa-live {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
  padding-left: 1px;
  font-size: 10.5px;
  color: var(--dsw-alias-state-success-primary);
}

.pa-live__pulse {
  position: relative;
  width: 6px;
  height: 6px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: var(--dsw-alias-state-success-primary);
}

.pa-live__pulse::after {
  content: '';
  position: absolute;
  inset: -3px;
  border: 1px solid color-mix(in srgb, var(--dsw-alias-state-success-primary) 45%, transparent);
  border-radius: 50%;
  animation: pa-live-pulse 2s ease-out infinite;
}

@keyframes pa-live-pulse {
  0% {
    transform: scale(0.6);
    opacity: 0.9;
  }
  70% {
    transform: scale(1.35);
    opacity: 0;
  }
  100% {
    opacity: 0;
  }
}

.pa-live .pa-time {
  color: var(--dsw-alias-label-tertiary);
}

/* 图例 */
.pa-legend {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-top: 2px;
  font-size: 9.5px;
  color: var(--dsw-alias-label-tertiary);
}

.pa-legend__dot {
  display: inline-block;
  width: 5px;
  height: 5px;
  margin-right: 3px;
  border-radius: 50%;
  background: var(--dsw-alias-label-tertiary);
}

/* 展开区 */
.pa-edge {
  display: flex;
  flex-direction: column;
  gap: 7px;
  margin: 2px 4px 8px 104px;
  padding: 9px 10px 10px;
  background: var(--dsw-alias-bg-layer-2);
  border: 0.5px solid var(--dsw-alias-border-l2);
  border-radius: 9px;
  min-width: 0;
}

.pa-edge__head {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  color: var(--dsw-alias-label-tertiary);
  min-width: 0;
}

.pa-edge__head .pa-who {
  font-size: 10.5px;
}

.pa-edge__meta {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pa-edge__quote {
  margin: 0;
  padding-left: 8px;
  border-left: 2px solid color-mix(in srgb, var(--dsw-alias-state-business-primary) 40%, transparent);
  font-size: 11px;
  line-height: 17px;
  color: var(--dsw-alias-label-secondary);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  max-height: 168px;
  overflow-y: auto;
}

.pa-edge__sub {
  margin-top: 2px;
  font-size: 9.5px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--dsw-alias-label-tertiary);
}

.pa-edge__list {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.pa-edge__li {
  display: flex;
  gap: 6px;
  font-size: 10.5px;
  line-height: 16px;
  color: var(--dsw-alias-label-secondary);
}

.pa-edge__li em {
  min-width: 28px;
  font-style: normal;
  font-size: 9.5px;
  color: var(--dsw-alias-label-tertiary);
  font-variant-numeric: tabular-nums;
}

.pa-edge__tree {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.pa-edge__tree div {
  font-size: 10px;
  line-height: 15px;
  color: var(--dsw-alias-label-secondary);
}

.pa-edge__tree .pa-edge__tree-item {
  display: flex;
  align-items: baseline;
  gap: 5px;
}

.pa-edge__tree .pa-edge__tree-indent {
  padding-left: 12px;
  color: var(--dsw-alias-label-tertiary);
}

.pa-edge__tree .pa-edge__tree-dot {
  display: inline-block;
  width: 4px;
  height: 4px;
  margin-right: 1px;
  border-radius: 50%;
  background: var(--dsw-alias-state-business-primary);
  vertical-align: 1px;
}

.pa-edge__actions {
  display: flex;
  gap: 6px;
  margin-top: 2px;
}

.pa-edge__action {
  height: 22px;
  padding: 0 8px;
  border: 0.5px solid var(--dsw-alias-border-l2);
  border-radius: 6px;
  background: var(--dsw-alias-bg-layer-3);
  font-size: 10px;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
}

.pa-edge__action:hover {
  color: var(--dsw-alias-label-primary);
}

.pa-edge__empty {
  font-size: 10px;
  color: var(--dsw-alias-label-tertiary);
}

/* 交付 */
.pa-kv {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.pa-kv__key {
  font-size: 9.5px;
  letter-spacing: 0.04em;
  color: var(--dsw-alias-label-tertiary);
}

.pa-kv__value {
  font-size: 11px;
  line-height: 17px;
  color: var(--dsw-alias-label-secondary);
  overflow-wrap: anywhere;
}

.pa-report {
  margin: 0;
  font-size: 11px;
  line-height: 17px;
  color: var(--dsw-alias-label-secondary);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.pa-tiles {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1px;
  margin-top: 1px;
  padding-top: 9px;
  border-top: 0.5px solid var(--dsw-alias-border-l1);
}

.pa-tile {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 0 2px;
  min-width: 0;
}

.pa-tile b {
  font-size: 13px;
  font-weight: 600;
  color: var(--dsw-alias-label-primary);
  font-variant-numeric: tabular-nums;
}

.pa-tile span {
  font-size: 9.5px;
  color: var(--dsw-alias-label-tertiary);
}

.pa-empty-line {
  font-size: 11px;
  color: var(--dsw-alias-label-tertiary);
}

/* 折叠行 */
.pa-fold {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 26px;
  padding: 0 9px;
  border: 0.5px solid var(--dsw-alias-border-l1);
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-1);
  font-size: 10.5px;
  color: var(--dsw-alias-label-tertiary);
  cursor: pointer;
}

.pa-fold__caret {
  font-size: 9px;
  color: var(--dsw-alias-label-tertiary);
}

.pa-fold__mono {
  font-family: var(--dsw-font-family-mono);
  font-size: 9.5px;
  color: var(--dsw-alias-label-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pa-fold__list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 6px 0 0;
  padding: 0;
  list-style: none;
}

.pa-fold__item {
  display: flex;
  gap: 8px;
  min-width: 0;
  font-size: 10px;
  color: var(--dsw-alias-label-tertiary);
}

.pa-fold__item b {
  flex: 0 0 auto;
  font-weight: 500;
  color: var(--dsw-alias-label-secondary);
}

.pa-fold__item span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--dsw-font-family-mono);
}

.pa-ticketpage--hidden {
  display: none;
}

@media (prefers-reduced-motion: reduce) {
  .pa-live__pulse::after {
    animation: none;
  }
}

@media (max-width: 520px) {
  .pa-graph__row {
    grid-template-columns: 80px minmax(0, 1fr);
  }
  .pa-rail {
    width: 80px;
  }
  .pa-edge {
    margin-left: 88px;
  }
}

/* 自绘的阶段徽标与次级按钮：字号/行高/留白与头部这一行绑死 */
.pa-tag {
  display: inline-flex;
  align-items: center;
  height: 16px;
  padding: 0 6px;
  border: 0.5px solid transparent;
  border-radius: 5px;
  background: var(--dsw-alias-bg-layer-3);
  font-size: 9.5px;
  font-weight: 600;
  line-height: 16px;
  color: var(--dsw-alias-label-secondary);
  white-space: nowrap;
}

.pa-tag--run {
  border-color: color-mix(in srgb, var(--dsw-alias-state-business-primary) 34%, transparent);
  background: color-mix(in srgb, var(--dsw-alias-state-business-primary) 14%, transparent);
  color: var(--dsw-alias-state-business-primary);
}

.pa-tag--done {
  border-color: color-mix(in srgb, var(--dsw-alias-state-success-primary) 32%, transparent);
  background: color-mix(in srgb, var(--dsw-alias-state-success-primary) 13%, transparent);
  color: var(--dsw-alias-state-success-primary);
}

.pa-tag--warn {
  border-color: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 36%, transparent);
  background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 14%, transparent);
  color: var(--dsw-alias-state-warn-label);
}

.pa-tag--err {
  border-color: color-mix(in srgb, var(--dsw-alias-state-error-primary) 36%, transparent);
  background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 13%, transparent);
  color: var(--dsw-alias-state-error-primary);
}

.pa-ghost {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 8px;
  border: 0.5px solid var(--dsw-alias-border-l2);
  border-radius: 7px;
  background: transparent;
  font-size: 11px;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
}

.pa-ghost:hover {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}
`
