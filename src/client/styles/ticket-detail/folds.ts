// src/client/styles/ticket-detail/folds.ts
//
// 工单详情域：折叠区与指标格。
// 类名与数值一律引用 styles/tokens.ts；本文件不定义新的设计变量。

export const TICKET_FOLDS_CSS = `
.pa-fold {
  flex: 0 0 auto;
  overflow: hidden;
  border: var(--pa-hairline) solid var(--dsw-alias-border-l2);
  border-radius: var(--pa-radius-sm);
  background: color-mix(in srgb, var(--dsw-alias-label-primary) 1.6%, transparent);
}
.pa-fold__button {
  display: flex;
  align-items: center;
  gap: var(--pa-space-6);
  box-sizing: border-box;
  width: 100%;
  height: var(--pa-control-height-md);
  padding: 0 var(--pa-space-9);
  border: 0;
  background: transparent;
  color: var(--dsw-alias-label-tertiary);
  font: inherit;
  font-size: var(--pa-font-size-label);
  text-align: left;
  cursor: pointer;
}
.pa-fold__button:hover {
  background: color-mix(in srgb, var(--dsw-alias-label-primary) 2.5%, transparent);
}
.pa-fold__button:focus-visible {
  outline: var(--pa-focus-ring);
  outline-offset: -1px;
}
.pa-fold__caret {
  color: var(--dsw-alias-label-caption);
  font-size: var(--pa-font-size-nano);
  transition: transform var(--pa-duration-fast) var(--pa-ease-standard);
}
.pa-fold--open .pa-fold__caret {
  transform: rotate(90deg);
}
.pa-fold__title {
  flex: 0 0 auto;
  color: var(--dsw-alias-label-secondary);
  font-weight: var(--pa-font-weight-medium);
}
.pa-fold__sub {
  flex: 0 1 auto;
  overflow: hidden;
  color: var(--dsw-alias-label-caption);
  font-size: var(--pa-font-size-2xs);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pa-fold__spacer {
  flex: 1 1 auto;
}
.pa-fold__meta {
  flex: 0 0 auto;
  color: var(--dsw-alias-label-caption);
  font-family: var(--pa-font-family-mono);
  font-size: var(--pa-font-size-2xs);
  white-space: nowrap;
}
.pa-fold__body {
  display: flex;
  flex-direction: column;
  gap: var(--pa-space-3);
  padding: var(--pa-space-2) var(--pa-space-10) var(--pa-space-10);
  border-top: var(--pa-hairline) solid var(--dsw-alias-border-l1);
}
.pa-fold__kv {
  display: flex;
  flex-direction: column;
  gap: var(--pa-space-2);
  margin-top: var(--pa-space-5);
}
.pa-fold__key {
  color: var(--dsw-alias-label-tertiary);
  font-size: var(--pa-font-size-xs);
  letter-spacing: var(--pa-letter-spacing-caps);
}
.pa-fold__value {
  color: var(--dsw-alias-label-secondary);
  font-size: var(--pa-font-size-note);
  line-height: var(--pa-line-height-18);
  overflow-wrap: anywhere;
}
.pa-fold__value--muted {
  color: var(--dsw-alias-label-tertiary);
}
.pa-fold__report {
  margin: 0;
  color: var(--dsw-alias-label-secondary);
  font-size: var(--pa-font-size-caption);
  line-height: var(--pa-line-height-18);
  overflow-wrap: anywhere;
}
.pa-fold__report p {
  margin: 0 0 var(--pa-space-6);
}
.pa-fold__report p:last-child {
  margin-bottom: 0;
}
.pa-fold__report ul,
.pa-fold__report ol {
  margin: var(--pa-space-4) 0;
  padding-left: var(--pa-space-18);
}
.pa-fold__report code {
  padding: 0 var(--pa-space-3);
  border-radius: var(--pa-radius-3);
  background: var(--dsw-alias-bg-layer-2);
  font-family: var(--pa-font-family-mono);
  font-size: var(--pa-font-size-label);
}
.pa-tiles {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--pa-space-1);
  margin-top: var(--pa-space-9);
  padding-top: var(--pa-space-8);
  border-top: var(--pa-hairline) solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-border-l1);
}
.pa-tile {
  display: flex;
  flex-direction: column;
  gap: var(--pa-space-1);
  min-width: 0;
  padding: 0 var(--pa-space-2);
  background: var(--dsw-alias-bg-layer-1);
}
.pa-tile__value {
  color: var(--dsw-alias-label-primary);
  font-size: var(--pa-font-size-body);
  font-variant-numeric: tabular-nums;
  font-weight: var(--pa-font-weight-semibold);
}
.pa-tile__label {
  color: var(--dsw-alias-label-tertiary);
  font-size: var(--pa-font-size-2xs);
}
`
