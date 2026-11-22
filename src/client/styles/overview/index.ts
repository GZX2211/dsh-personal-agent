// src/client/styles/overview/index.ts
//
// 概览域：页面布局、脉搏、注意力、worker 舰队、今日面板、页脚、空态与骨架。
// 类名与数值一律引用 styles/tokens.ts；本文件不定义新的设计变量。

export const OVERVIEW_CSS = `
/* ── 概览页 ─────────────────────────────────────────────────────────── */
.pa-overview {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: var(--pa-space-14);
  box-sizing: border-box;
  min-height: 0;
  padding: var(--pa-space-12) var(--pa-space-16) var(--pa-space-16);
  overflow-y: auto;
  overscroll-behavior: contain;
}
.pa-overview__pulse {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  gap: var(--pa-space-8);
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
  outline: var(--pa-focus-ring);
  outline-offset: 2px;
  border-radius: var(--pa-radius-2);
}
.pa-overview__pulse-copy {
  display: inline-flex;
  flex: 1 1 auto;
  align-items: center;
  gap: var(--pa-space-6);
  min-width: 0;
}
.pa-overview__pulse-dot {
  flex: 0 0 auto;
}
.pa-overview__pulse-label {
  overflow: hidden;
  color: var(--dsw-alias-label-secondary);
  font-size: var(--pa-font-size-body);
  line-height: var(--pa-line-height-20);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pa-overview__pulse-ago {
  flex: 0 0 auto;
  color: var(--dsw-alias-label-tertiary);
  font-size: var(--pa-font-size-label);
  line-height: var(--pa-line-height-16);
}

.pa-overview__attention {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  gap: var(--pa-space-6);
}
.pa-overview__attention-row {
  display: flex;
  align-items: flex-start;
  gap: var(--pa-space-8);
  width: 100%;
  padding: var(--pa-space-8) var(--pa-space-10);
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
  outline: var(--pa-focus-ring);
  outline-offset: 2px;
}
.pa-overview__attention-main {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: var(--pa-space-1);
  min-width: 0;
}
.pa-overview__attention-main > span:first-child {
  color: var(--dsw-alias-label-primary);
  font-size: var(--pa-font-size-caption);
  line-height: var(--pa-line-height-18);
}
.pa-overview__attention-meta {
  color: var(--dsw-alias-label-tertiary);
  font-size: var(--pa-font-size-label);
  line-height: var(--pa-line-height-16);
}
.pa-overview__attention-arrow {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  color: var(--dsw-alias-label-tertiary);
}
.pa-overview__attention-more {
  padding-left: var(--pa-space-2);
  color: var(--dsw-alias-label-tertiary);
  font-size: var(--pa-font-size-label);
  line-height: var(--pa-line-height-16);
}

.pa-overview__fleet {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  gap: var(--pa-space-6);
}
.pa-overview__fleet-head {
  display: flex;
  align-items: center;
  gap: var(--pa-space-8);
  min-width: 0;
}
.pa-overview__fleet-title {
  color: var(--dsw-alias-label-secondary);
  font-size: var(--pa-font-size-caption);
  font-weight: var(--pa-font-weight-medium);
  line-height: var(--pa-line-height-18);
}
.pa-overview__fleet-count {
  color: var(--dsw-alias-label-primary);
  font-size: var(--pa-font-size-caption);
  font-variant-numeric: tabular-nums;
  line-height: var(--pa-line-height-18);
}
.pa-overview__seats {
  display: inline-flex;
  align-items: center;
  gap: var(--pa-space-3);
}
.pa-overview__seat {
  width: var(--pa-seat-width);
  height: var(--pa-seat-height);
  border-radius: var(--pa-radius-2);
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
  height: var(--pa-seat-height);
  overflow: hidden;
  border-radius: var(--pa-radius-2);
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
  font-size: var(--pa-font-size-label);
  line-height: var(--pa-line-height-16);
  white-space: nowrap;
}
.pa-overview__workers {
  display: flex;
  flex-direction: column;
  gap: var(--pa-space-2);
}
.pa-overview__worker {
  display: flex;
  flex-direction: column;
  gap: var(--pa-space-2);
  width: 100%;
  padding: var(--pa-space-6) var(--pa-space-8);
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
  outline: var(--pa-focus-ring);
  outline-offset: 2px;
}
.pa-overview__worker-head {
  display: flex;
  align-items: center;
  gap: var(--pa-space-8);
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
  font-size: var(--pa-font-size-caption);
  line-height: var(--pa-line-height-18);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pa-overview__worker-sub {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--pa-space-8);
  min-width: 0;
  padding-left: var(--pa-space-16);
  color: var(--dsw-alias-label-tertiary);
  font-size: var(--pa-font-size-label);
  line-height: var(--pa-line-height-16);
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
  padding: var(--pa-space-2) var(--pa-space-8) var(--pa-space-2) var(--pa-space-24);
  border: 0;
  background: transparent;
  color: var(--dsw-alias-label-tertiary);
  font: inherit;
  font-size: var(--pa-font-size-label);
  line-height: var(--pa-line-height-16);
  text-align: left;
  cursor: pointer;
}
.pa-overview__worker-more:hover {
  color: var(--dsw-alias-label-primary);
}
.pa-overview__empty-line {
  margin: 0;
  color: var(--dsw-alias-label-tertiary);
  font-size: var(--pa-font-size-label);
  line-height: var(--pa-line-height-16);
}
.pa-overview__today {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  gap: var(--pa-space-8);
}
.pa-overview__section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--pa-space-8);
}
.pa-overview__section-title {
  margin: 0;
  color: var(--dsw-alias-label-secondary);
  font-size: var(--pa-font-size-caption);
  font-weight: var(--pa-font-weight-medium);
  line-height: var(--pa-line-height-18);
}
.pa-overview__section-side {
  color: var(--dsw-alias-label-tertiary);
  font-size: var(--pa-font-size-label);
  line-height: var(--pa-line-height-16);
}
.pa-overview__footer {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--pa-space-4) var(--pa-space-12);
  margin-top: auto;
  padding-top: var(--pa-space-2);
  color: var(--dsw-alias-label-tertiary);
  font-size: var(--pa-font-size-label);
  line-height: var(--pa-line-height-16);
}
.pa-overview__totals {
  min-width: 0;
}
.pa-overview__sources {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 0 var(--pa-space-8);
}
.pa-overview__sources-error {
  color: var(--dsw-alias-state-error-primary);
}

.pa-overview__empty {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--pa-space-8);
  margin: auto 0;
  padding: var(--pa-space-16) 0;
}
.pa-overview__empty-title {
  margin: 0;
  color: var(--dsw-alias-label-primary);
  font-size: var(--pa-font-size-title);
  font-weight: var(--pa-font-weight-medium);
  line-height: var(--pa-line-height-22);
}
.pa-overview__empty-body {
  margin: 0;
  color: var(--dsw-alias-label-secondary);
  font-size: var(--pa-font-size-caption);
  line-height: var(--pa-line-height-18);
}

.pa-overview__skeleton {
  display: flex;
  flex-direction: column;
  gap: var(--pa-space-12);
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
    gap: var(--pa-space-12);
    padding: var(--pa-space-10) var(--pa-space-12) var(--pa-space-14);
  }
  .pa-overview__pulse-ago {
    font-size: var(--pa-font-size-label);
  }
}
`