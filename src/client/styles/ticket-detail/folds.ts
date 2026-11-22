// src/client/styles/ticket-detail/folds.ts
//
// 工单详情域：折叠区与指标格。
// 类名与数值一律引用 styles/tokens.ts；本文件不定义新的设计变量。

export const TICKET_FOLDS_CSS = `
.pa-fold {
  flex: 0 0 auto;
  overflow: hidden;
  border: var(--pa-hairline) solid var(--dsw-alias-border-l2);
  border-radius: var(--pa-radius-md);
  background: var(--dsw-alias-bg-layer-1);
}
.pa-fold__button {
  display: flex;
  align-items: center;
  gap: var(--pa-space-6);
  box-sizing: border-box;
  width: 100%;
  height: var(--pa-control-height-sm);
  padding: 0 var(--pa-space-9);
  border: 0;
  background: transparent;
  color: var(--dsw-alias-label-tertiary);
  font: inherit;
  font-size: var(--pa-font-size-label);
  text-align: left;
  cursor: pointer;
  line-height: var(--pa-line-height-16);
}
.pa-fold__button:hover {
  background: color-mix(in srgb, var(--dsw-alias-label-primary) 2.5%, transparent);
}
.pa-fold__button:focus-visible {
  outline: var(--pa-focus-ring);
  outline-offset: -1px;
}
.pa-fold__caret {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--dsw-alias-label-caption);
  transition: transform var(--pa-duration-fast) var(--pa-ease-standard);
}
.pa-fold--open .pa-fold__caret {
  transform: rotate(90deg);
}
.pa-fold__title {
  flex: 0 0 auto;
  color: var(--dsw-alias-label-secondary);
  font-size: var(--pa-font-size-caption);
  font-weight: var(--pa-font-weight-semibold);
  line-height: var(--pa-line-height-18);
}
.pa-fold__sub {
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  color: var(--dsw-alias-label-caption);
  font-size: var(--pa-font-size-micro);
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: var(--pa-line-height-14);
}
.pa-fold__spacer {
  flex: 1 1 auto;
}
.pa-fold__meta {
  flex: 0 0 auto;
  color: var(--dsw-alias-label-caption);
  font-family: var(--pa-font-family-mono);
  font-size: var(--pa-font-size-micro);
  white-space: nowrap;
  line-height: var(--pa-line-height-14);
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
  font-size: var(--pa-font-size-label);
  letter-spacing: var(--pa-letter-spacing-caps);
  line-height: var(--pa-line-height-16);
}
.pa-fold__value {
  color: var(--dsw-alias-label-secondary);
  font-size: var(--pa-font-size-caption);
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
  border-radius: var(--pa-radius-xs);
  background: var(--dsw-alias-bg-layer-2);
  font-family: var(--pa-font-family-mono);
  font-size: var(--pa-font-size-label);
}
/* 工单详情折叠区里的指标卡：位置间距，外观由 shared.ts 的 .pa-metrics 提供 */
.pa-fold__metrics {
  margin-top: var(--pa-space-8);
}
/* 四列比概览三列更密，数值降一档，避免「1 小时 23 分钟」这类时长换行。 */
.pa-fold__metrics .pa-metric__value {
  font-size: var(--pa-font-size-title-lg);
}
`