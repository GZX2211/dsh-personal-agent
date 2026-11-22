// src/client/styles/overview/context.ts
//
// 概览域：上下文占用环。
// 类名与数值一律引用 styles/tokens.ts；本文件不定义新的设计变量。

export const OVERVIEW_CONTEXT_CSS = `
.pa-context {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: var(--pa-space-4);
  color: var(--dsw-alias-label-tertiary);
  font-size: var(--pa-font-size-micro);
  line-height: var(--pa-line-height-14);
  white-space: nowrap;
}
.pa-context__label {
  color: var(--dsw-alias-label-tertiary);
}
.pa-context__value {
  color: var(--dsw-alias-label-secondary);
  font-size: var(--pa-font-size-label);
  font-variant-numeric: tabular-nums;
  line-height: var(--pa-line-height-16);
}
.pa-context[data-level='warn'] .pa-context__value {
  color: var(--dsw-alias-state-warn-label);
}
.pa-context[data-level='critical'] .pa-context__value {
  color: var(--dsw-alias-state-error-primary);
}
.pa-context__ring {
  flex: 0 0 auto;
  width: var(--pa-icon-size-md);
  height: var(--pa-icon-size-md);
}
`
