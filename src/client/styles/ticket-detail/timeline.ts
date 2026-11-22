// src/client/styles/ticket-detail/timeline.ts
//
// 工单详情域：交接时间线、泳道图容器与实时行。
// 类名与数值一律引用 styles/tokens.ts；本文件不定义新的设计变量。

export const TICKET_TIMELINE_CSS = `
.pa-timeline {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  gap: var(--pa-space-8);
  box-sizing: border-box;
  min-width: 0;
  padding: var(--pa-space-10) var(--pa-space-12);
  border: var(--pa-hairline) solid var(--dsw-alias-border-l2);
  border-radius: var(--pa-radius-md);
  background: var(--dsw-alias-bg-layer-1);
}
.pa-timeline__head {
  display: flex;
  align-items: center;
  gap: var(--pa-space-6);
  height: var(--pa-control-height-xs);
  min-width: 0;
}
.pa-timeline__title {
  flex: 0 0 auto;
  color: var(--dsw-alias-label-secondary);
  font-size: var(--pa-font-size-caption);
  font-weight: var(--pa-font-weight-semibold);
  letter-spacing: var(--pa-letter-spacing-wide);
  white-space: nowrap;
}
.pa-timeline__view {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: var(--pa-space-1);
  box-sizing: border-box;
  height: var(--pa-control-height-xs);
  padding: var(--pa-space-1);
  border: var(--pa-hairline) solid var(--dsw-alias-border-l1);
  border-radius: var(--pa-radius-sm);
  background: var(--dsw-alias-bg-layer-2);
}
.pa-timeline__view-tab {
  box-sizing: border-box;
  height: 20px;
  padding: 0 var(--pa-space-6);
  border: 0;
  border-radius: var(--pa-radius-xs);
  background: transparent;
  color: var(--dsw-alias-label-tertiary);
  font: inherit;
  font-size: var(--pa-font-size-label);
  line-height: var(--pa-line-height-16);
  white-space: nowrap;
  cursor: pointer;
  font-weight: var(--pa-font-weight-medium);
}
.pa-timeline__view-tab:hover {
  color: var(--dsw-alias-label-primary);
}
.pa-timeline__view-tab[aria-selected='true'] {
  background: var(--dsw-alias-bg-layer-3);
  color: var(--dsw-alias-label-primary);
}
.pa-timeline__view-tab:focus-visible {
  outline: var(--pa-focus-ring);
  outline-offset: -1px;
}
.pa-timeline__spacer {
  flex: 1 1 auto;
  min-width: 4px;
}
.pa-timeline__focus {
  overflow: hidden;
  max-width: 118px;
  padding: 0 var(--pa-space-6);
  border: var(--pa-hairline) solid color-mix(in srgb, var(--dsw-alias-state-business-primary) 24%, transparent);
  border-radius: var(--pa-radius-pill);
  background: color-mix(in srgb, var(--dsw-alias-state-business-primary) 10%, transparent);
  color: var(--dsw-alias-state-business-primary);
  font: inherit;
  font-size: var(--pa-font-size-label);
  line-height: var(--pa-line-height-16);
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
  height: var(--pa-tag-height);
}
.pa-timeline__meta {
  flex: 0 1 auto;
  overflow: hidden;
  color: var(--dsw-alias-label-tertiary);
  font-size: var(--pa-font-size-label);
  font-variant-numeric: tabular-nums;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pa-timeline__origin {
  display: flex;
  align-items: center;
  gap: var(--pa-space-6);
  min-width: 0;
  padding: var(--pa-space-1) var(--pa-space-1) var(--pa-space-2);
  color: var(--dsw-alias-label-tertiary);
  font-size: var(--pa-font-size-label);
}
.pa-timeline__origin-kind {
  flex: 0 0 auto;
  padding: 0 var(--pa-tag-padding-x);
  border: var(--pa-hairline) solid color-mix(in srgb, var(--dsw-alias-state-business-primary) 26%, transparent);
  border-radius: var(--pa-radius-xs);
  background: color-mix(in srgb, var(--dsw-alias-state-business-primary) 12%, transparent);
  color: color-mix(in srgb, var(--dsw-alias-state-business-primary) 72%, var(--dsw-alias-label-primary));
  font-size: var(--pa-font-size-label);
  font-weight: var(--pa-font-weight-medium);
  line-height: var(--pa-line-height-16);
  height: var(--pa-tag-height);
  display: inline-flex;
  align-items: center;
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
  font-size: var(--pa-font-size-label);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  line-height: var(--pa-line-height-16);
}
.pa-timeline__banner {
  padding: var(--pa-space-4) var(--pa-space-8);
  border-radius: var(--pa-radius-sm);
  font-size: var(--pa-font-size-label);
  line-height: var(--pa-line-height-16);
}
.pa-timeline__banner--unavailable {
  border: var(--pa-hairline) solid color-mix(in srgb, var(--dsw-alias-state-warn-primary) 28%, transparent);
  background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 8%, transparent);
  color: var(--dsw-alias-state-warn-label);
}
.pa-timeline__banner--partial {
  border: var(--pa-hairline) solid color-mix(in srgb, var(--dsw-alias-state-business-primary) 24%, transparent);
  background: color-mix(in srgb, var(--dsw-alias-state-business-primary) 8%, transparent);
  color: var(--dsw-alias-label-secondary);
}
.pa-timeline__empty {
  padding: var(--pa-space-12) var(--pa-space-4);
  color: var(--dsw-alias-label-tertiary);
  font-size: var(--pa-font-size-label);
  line-height: var(--pa-line-height-16);
  text-align: center;
}
.pa-timeline__legend {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--pa-space-4) var(--pa-space-10);
  padding-top: var(--pa-space-1);
  color: var(--dsw-alias-label-caption);
  font-size: var(--pa-font-size-micro);
  line-height: var(--pa-line-height-14);
}
.pa-timeline__legend span {
  display: inline-flex;
  align-items: center;
  gap: var(--pa-space-4);
}
.pa-timeline__legend-dot {
  width: var(--pa-dot-size-sm);
  height: var(--pa-dot-size-sm);
  border-radius: var(--pa-radius-circle);
  background: var(--dsw-alias-label-tertiary);
}
.pa-timeline__legend-line {
  width: var(--pa-legend-line-width);
  height: var(--pa-legend-line-height);
  border-radius: var(--pa-radius-1);
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
  margin-top: var(--pa-space-2);
  padding: 0 var(--pa-space-8);
  border: var(--pa-hairline) solid color-mix(in srgb, var(--dsw-alias-state-business-primary) 32%, transparent);
  border-radius: var(--pa-radius-pill);
  background: var(--dsw-alias-bg-layer-3);
  color: var(--dsw-alias-state-business-primary);
  font: inherit;
  font-size: var(--pa-font-size-label);
  line-height: var(--pa-line-height-16);
  cursor: pointer;
  box-shadow: var(--pa-shadow-float);
  height: var(--pa-control-height-xs);
  display: inline-flex;
  align-items: center;
}
.pa-live__text {
  overflow: hidden;
  min-width: 0;
  color: color-mix(in srgb, var(--dsw-alias-state-success-primary) 72%, var(--dsw-alias-label-primary));
  font-size: var(--pa-font-size-label);
  line-height: var(--pa-line-height-16);
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
  transition: transform var(--pa-duration-rotate) var(--pa-ease-standard);
}
.pa-live__item {
  display: block;
  height: 17px;
  overflow: hidden;
  color: color-mix(in srgb, var(--dsw-alias-state-success-primary) 72%, var(--dsw-alias-label-primary));
  font-size: var(--pa-font-size-label);
  line-height: var(--pa-line-height-16);
  text-overflow: ellipsis;
  white-space: nowrap;
}
@media (prefers-reduced-motion: reduce) {
  .pa-live__track {
    transition: none;
  }
}
`
