// src/client/styles/ticket-detail/lanes.ts
//
// 工单详情域：泳道表头。
// 类名与数值一律引用 styles/tokens.ts；本文件不定义新的设计变量。

export const TICKET_LANES_CSS = `
.pa-lanes {
  position: sticky;
  top: 0;
  z-index: var(--pa-z-lane-header);
  display: flex;
  flex: 0 0 auto;
  height: 40px;
  overflow: visible;
  border-bottom: var(--pa-border-width-thin) solid var(--dsw-alias-border-l1);
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
  gap: var(--pa-space-1);
  box-sizing: border-box;
  min-width: 0;
  padding: 0;
  border: 0;
  border-radius: var(--pa-radius-6);
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  cursor: pointer;
}
.pa-lane:hover {
  background: color-mix(in srgb, var(--dsw-alias-label-primary) 4%, transparent);
}
.pa-lane:focus-visible {
  outline: var(--pa-focus-ring);
  outline-offset: -1px;
}
.pa-lane__name {
  display: inline-flex;
  align-items: center;
  gap: var(--pa-space-3);
  overflow: hidden;
  max-width: 100%;
  padding: 0 var(--pa-space-1);
  color: inherit;
  font-family: var(--pa-font-family-mono);
  font-size: var(--pa-font-size-xs);
  font-weight: var(--pa-font-weight-medium);
  line-height: var(--pa-line-height-13);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pa-lane__dot {
  flex: 0 0 auto;
  width: var(--pa-dot-size-xs);
  height: var(--pa-dot-size-xs);
  border-radius: var(--pa-radius-circle);
}
.pa-lane__role {
  overflow: hidden;
  max-width: 100%;
  color: var(--dsw-alias-label-caption);
  font-size: var(--pa-font-size-nano);
  line-height: var(--pa-line-height-11);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pa-lane--focused {
  background: color-mix(in srgb, var(--dsw-alias-state-business-primary) 10%, transparent);
  box-shadow: inset 0 0 0 var(--pa-hairline) color-mix(in srgb, var(--dsw-alias-state-business-primary) 36%, transparent);
}
.pa-lane--focused .pa-lane__name {
  color: var(--dsw-alias-label-primary);
}
.pa-lane--dim {
  opacity: 0.3;
}
.pa-lane--more {
  border-left: var(--pa-border-width-thin) dashed var(--dsw-alias-border-l2);
}
.pa-lane--more .pa-lane__name {
  color: var(--dsw-alias-label-tertiary);
}
`
