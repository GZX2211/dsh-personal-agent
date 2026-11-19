// src/client/style.ts
//
// 面板样式：颜色/圆角/字号/阴影一律取宿主 design token，不复制设计变量。
//
// 官方的控件（Button / Pill / Input / Modal / Tag / StateDot / PathLabel）
// 直接由 @deepseek-ai/dsh-client-ui-primitives 提供，本文件不再定义它们的
// 外观；这里只保留官方没有的三类东西：面板骨架、列表行、审批详情。
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
.pa-console__placeholder {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 16px;
  font-size: 13px;
  line-height: 20px;
  color: var(--dsw-alias-label-secondary);
}
.pa-console__placeholder strong {
  color: var(--dsw-alias-label-primary);
  font-weight: 500;
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
  flex: 1 1 auto;
  width: 220px;
  max-width: 260px;
  min-width: 140px;
}
.pa-toolbar__help {
  flex: 0 0 auto;
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
.pa-row__leading {
  display: inline-flex;
  flex: 0 0 10px;
  align-items: center;
  justify-content: center;
  margin-top: 6px;
}
.pa-row__body {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.pa-row__title {
  margin: 0;
  overflow: hidden;
  color: var(--dsw-alias-label-primary);
  font-size: 14px;
  font-weight: 500;
  line-height: 22px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pa-row__meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0 6px;
  min-width: 0;
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  line-height: 18px;
}
.pa-row__meta-link {
  max-width: 100%;
  padding: 0;
  overflow: hidden;
  border: 0;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}
.pa-row__meta-link:hover {
  color: var(--dsw-alias-state-business-primary);
}
.pa-row__meta-link:focus-visible {
  outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
  outline-offset: 2px;
  border-radius: 2px;
}
.pa-row__meta-sep {
  color: var(--dsw-alias-label-caption);
}
.pa-row__time {
  color: var(--dsw-alias-label-tertiary);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.pa-row__summary {
  display: -webkit-box;
  margin: 0;
  overflow: hidden;
  color: var(--dsw-alias-label-secondary);
  font-size: 13px;
  line-height: 20px;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
.pa-row__aside {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 4px;
  margin-top: 1px;
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
  padding: 0 12px 12px 30px;
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
  .pa-console__tab {
    transition: none;
  }
}
`
