// src/client/styles/approvals.ts
//
// 审批域：详情字段、选项、回答、附件、页脚与提交提示。
// 类名与数值一律引用 styles/tokens.ts；本文件不定义新的设计变量。

export const APPROVALS_CSS = `
/* ── 审批详情：官方没有的字段容器，材质与行一致 ─────────────────────── */
.pa-detail {
  display: flex;
  flex-direction: column;
  gap: var(--pa-space-8);
  min-width: 0;
  padding-top: var(--pa-space-8);
  border-top: var(--pa-hairline) solid var(--dsw-alias-border-l1);
}
.pa-detail__question {
  margin: 0;
  color: var(--dsw-alias-label-primary);
  font-size: var(--pa-font-size-body);
  line-height: var(--pa-line-height-20);
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}
.pa-detail__facts {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--pa-space-4);
}
.pa-detail__fact {
  flex: 0 0 auto;
}
.pa-detail__options {
  display: flex;
  flex-direction: column;
  gap: var(--pa-space-2);
}
.pa-detail__option {
  border: var(--pa-hairline) solid transparent;
  border-radius: var(--dsw-radius-sm);
  transition: background-color var(--pa-duration-fast) var(--pa-ease-standard), border-color var(--pa-duration-fast) var(--pa-ease-standard);
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
  gap: var(--pa-space-8);
  width: 100%;
  min-width: 0;
  padding: var(--pa-space-6) var(--pa-space-8);
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
  outline: var(--pa-focus-ring);
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
  margin-top: var(--pa-space-1);
  border-radius: var(--dsw-radius-xs);
  background: var(--dsw-alias-bg-overlay);
  color: var(--dsw-alias-label-secondary);
  font-size: var(--pa-font-size-label);
  font-weight: var(--pa-font-weight-medium);
  line-height: var(--pa-line-height-16);
}
.pa-detail__option-copy {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: var(--pa-space-2);
  min-width: 0;
}
.pa-detail__option-label {
  color: var(--dsw-alias-label-primary);
  font-size: var(--pa-font-size-body);
  font-weight: var(--pa-font-weight-medium);
  line-height: var(--pa-line-height-20);
  overflow-wrap: anywhere;
}
.pa-detail__option-desc {
  color: var(--dsw-alias-label-tertiary);
  font-size: var(--pa-font-size-caption);
  line-height: var(--pa-line-height-18);
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

/* 回答行与附件行：与选项行同高、同内边距、同文字起点。 */
.pa-detail__answer,
.pa-detail__attachments {
  display: flex;
  align-items: flex-start;
  gap: var(--pa-space-8);
  width: 100%;
  padding: var(--pa-space-6) var(--pa-space-8);
  border: var(--pa-hairline) solid transparent;
  border-radius: var(--dsw-radius-sm);
}
.pa-detail__answer {
  transition: background-color var(--pa-duration-fast) var(--pa-ease-standard), border-color var(--pa-duration-fast) var(--pa-ease-standard);
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
  font-size: var(--pa-font-size-body);
  line-height: var(--pa-line-height-20);
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
  font-size: var(--pa-font-size-body);
  line-height: var(--pa-line-height-20);
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}
.pa-detail__attachment-copy {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0 var(--pa-space-6);
  min-width: 0;
  color: var(--dsw-alias-label-primary);
  font-size: var(--pa-font-size-body);
  line-height: var(--pa-line-height-20);
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
  outline: var(--pa-focus-ring);
  outline-offset: 2px;
  border-radius: var(--pa-radius-2);
}
.pa-detail__attachment-hint {
  color: var(--dsw-alias-label-tertiary);
  font-size: var(--pa-font-size-caption);
  line-height: var(--pa-line-height-18);
}

/* ── 详情页脚 ───────────────────────────────────────────────────────── */
.pa-detail__footer {
  display: flex;
  align-items: center;
  gap: var(--pa-space-8);
  margin-top: var(--pa-space-2);
  padding-top: var(--pa-space-8);
  border-top: var(--pa-hairline) solid var(--dsw-alias-border-l1);
}
.pa-detail__progress {
  flex: 0 0 auto;
  color: var(--dsw-alias-label-tertiary);
  font-size: var(--pa-font-size-caption);
  line-height: var(--pa-line-height-18);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.pa-detail__feedback {
  flex: 1;
  min-height: 18px;
  color: var(--dsw-alias-state-error-primary);
  font-size: var(--pa-font-size-caption);
  line-height: var(--pa-line-height-18);
  text-align: right;
  overflow-wrap: anywhere;
}
.pa-detail__actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: var(--pa-space-8);
}

.pa-notice {
  margin: 0;
  padding: 0 var(--pa-space-16) var(--pa-space-8);
  color: var(--dsw-alias-state-business-primary);
  font-size: var(--pa-font-size-caption);
  line-height: var(--pa-line-height-18);
}
`
