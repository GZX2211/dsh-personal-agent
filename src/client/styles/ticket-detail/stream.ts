// src/client/styles/ticket-detail/stream.ts
//
// 工单详情域：事件流视图（规模化降级时的交接行列表）。
// 类名与数值一律引用 styles/tokens.ts；本文件不定义新的设计变量。

export const TICKET_STREAM_CSS = `
.pa-stream {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.pa-stream__row-wrap {
  border-bottom: var(--pa-border-width-thin) solid color-mix(in srgb, var(--dsw-alias-border-l1) 55%, transparent);
}
.pa-stream__row-wrap:last-child {
  border-bottom: 0;
}
.pa-stream__row {
  display: grid;
  grid-template-columns: 40px 44px 118px minmax(0, 1fr);
  gap: var(--pa-space-6);
  align-items: center;
  box-sizing: border-box;
  width: 100%;
  min-height: 36px;
  padding: 0 var(--pa-space-2);
  border: 0;
  border-radius: var(--pa-radius-sm);
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
  outline: var(--pa-focus-ring);
  outline-offset: -1px;
}
.pa-stream__row--selected {
  background: color-mix(in srgb, var(--dsw-alias-state-business-primary) 7%, transparent);
  box-shadow: inset 0 0 0 var(--pa-hairline) color-mix(in srgb, var(--dsw-alias-state-business-primary) 30%, transparent);
}
.pa-stream__time {
  color: var(--dsw-alias-label-tertiary);
  font-size: var(--pa-font-size-label);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  line-height: var(--pa-line-height-16);
}
.pa-stream__kind {
  justify-self: start;
  padding: 0 var(--pa-tag-padding-x);
  border: var(--pa-hairline) solid color-mix(in srgb, var(--pa-kind) 34%, transparent);
  border-radius: var(--pa-radius-xs);
  background: color-mix(in srgb, var(--pa-kind) 12%, transparent);
  color: var(--pa-kind);
  font-size: var(--pa-font-size-label);
  line-height: var(--pa-line-height-16);
  white-space: nowrap;
  font-weight: var(--pa-font-weight-medium);
  height: var(--pa-tag-height);
  display: inline-flex;
  align-items: center;
}
.pa-stream__flow {
  overflow: hidden;
  color: var(--dsw-alias-label-tertiary);
  font-size: var(--pa-font-size-label);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pa-stream__flow b {
  color: var(--dsw-alias-label-secondary);
  font-family: var(--pa-font-family-mono);
  font-weight: var(--pa-font-weight-medium);
}
.pa-stream__arrow {
  display: inline-flex;
  align-items: center;
  margin: 0 var(--pa-space-3);
  color: var(--dsw-alias-label-caption);
  vertical-align: middle;
}
.pa-stream__summary {
  overflow: hidden;
  color: var(--dsw-alias-label-secondary);
  font-size: var(--pa-font-size-label);
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: var(--pa-line-height-16);
}
.pa-stream__expand {
  margin: 0 var(--pa-space-2) var(--pa-space-6);
  padding: var(--pa-space-8) var(--pa-space-10) var(--pa-space-10);
  border: var(--pa-hairline) solid var(--dsw-alias-border-l2);
  border-left: var(--pa-border-width-emphasis) solid var(--pa-kind);
  border-radius: 0 var(--pa-radius-sm) var(--pa-radius-sm) 0;
  background: var(--dsw-alias-bg-layer-2);
}

`
