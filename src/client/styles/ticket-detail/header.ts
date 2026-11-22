// src/client/styles/ticket-detail/header.ts
//
// 工单详情域：详情容器与页头。
// 类名与数值一律引用 styles/tokens.ts；本文件不定义新的设计变量。

export const TICKET_HEADER_CSS = `
.pa-ticket-detail {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: var(--pa-space-10);
  box-sizing: border-box;
  min-height: 0;
  padding: var(--pa-space-10) var(--pa-space-14) var(--pa-space-16);
  overflow-y: auto;
  overscroll-behavior: contain;
}

.pa-td__head {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  gap: var(--pa-space-5);
  min-width: 0;
}
.pa-td__fallback-head {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  height: var(--pa-control-height-xs);
}
.pa-td__topline {
  display: flex;
  align-items: center;
  gap: var(--pa-space-8);
  height: var(--pa-control-height-xs);
  min-width: 0;
}
.pa-td__back {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: var(--pa-control-height-xs);
  min-width: var(--pa-control-height-xs);
  height: var(--pa-control-height-xs);
  padding: 0;
  border: 0;
  border-radius: var(--pa-radius-sm);
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: inherit;
  line-height: var(--pa-line-height-none);
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
  outline: var(--pa-focus-ring);
  outline-offset: 1px;
}
.pa-td__ref {
  overflow: hidden;
  color: var(--dsw-alias-label-tertiary);
  font-size: var(--pa-font-size-label);
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: var(--pa-line-height-16);
}
.pa-td__ref b {
  color: var(--dsw-alias-label-secondary);
  font-family: var(--pa-font-family-mono);
  font-weight: var(--pa-font-weight-medium);
  letter-spacing: var(--pa-letter-spacing-wide);
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
  height: var(--pa-control-height-xs);
  padding: 0 var(--pa-space-8);
  border: 0;
  border-radius: var(--pa-radius-sm);
  background: transparent;
  box-shadow: inset 0 0 0 var(--pa-hairline) var(--dsw-alias-border-l2);
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: var(--pa-font-size-label);
  line-height: var(--pa-line-height-16);
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
  height: var(--pa-control-height-xs);
  padding: 0 var(--pa-space-8);
  border: 0;
  border-radius: var(--pa-radius-sm);
  background: transparent;
  box-shadow: inset 0 0 0 var(--pa-hairline) var(--dsw-alias-border-l2);
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: var(--pa-font-size-label);
  line-height: var(--pa-line-height-16);
  cursor: pointer;
}
.pa-td__retry:hover {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}
.pa-td__retry--inline {
  flex: 0 0 auto;
  height: var(--pa-control-height-xs);
  font-size: var(--pa-font-size-label);
}
.pa-td__title {
  overflow: hidden;
  margin: 0;
  color: var(--dsw-alias-label-primary);
  font-size: var(--pa-font-size-title-lg);
  font-weight: var(--pa-font-weight-semibold);
  line-height: var(--pa-line-height-24);
  letter-spacing: var(--pa-letter-spacing-tight);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pa-td__meta {
  display: flex;
  align-items: center;
  gap: 0;
  overflow: hidden;
  color: var(--dsw-alias-label-tertiary);
  font-size: var(--pa-font-size-label);
  line-height: var(--pa-line-height-16);
  white-space: nowrap;
}
.pa-td__meta-item {
  display: inline-flex;
  align-items: center;
  gap: var(--pa-space-4);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}
.pa-td__meta-item + .pa-td__meta-item::before {
  content: '·';
  margin: 0 var(--pa-space-6);
  color: var(--dsw-alias-border-l3);
}
.pa-td__meta-item b {
  color: var(--dsw-alias-label-secondary);
  font-family: var(--pa-font-family-mono);
  font-size: var(--pa-font-size-label);
  font-weight: var(--pa-font-weight-medium);
}
.pa-td__notice {
  display: flex;
  align-items: center;
  gap: var(--pa-space-8);
  padding: var(--pa-space-5) var(--pa-space-8);
  border: var(--pa-hairline) solid var(--dsw-alias-state-warn-primary);
  border-radius: var(--dsw-radius-sm);
  background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 8%, transparent);
  color: var(--dsw-alias-state-warn-label);
  font-size: var(--pa-font-size-label);
  line-height: var(--pa-line-height-16);
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
  gap: var(--pa-space-8);
  padding: var(--pa-space-24) var(--pa-space-4);
  color: var(--dsw-alias-label-tertiary);
  font-size: var(--pa-font-size-caption);
  line-height: var(--pa-line-height-18);
}
.pa-td__state--error {
  color: var(--dsw-alias-state-error-primary);
}
.pa-td__state-title {
  margin: 0;
  color: var(--dsw-alias-label-primary);
  font-size: var(--pa-font-size-body);
  font-weight: var(--pa-font-weight-medium);
}
.pa-td__state-body {
  margin: 0;
  overflow-wrap: anywhere;
  color: var(--dsw-alias-label-secondary);
  font-size: var(--pa-font-size-label);
  line-height: var(--pa-line-height-16);
}
`
