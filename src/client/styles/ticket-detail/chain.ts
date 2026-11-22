// src/client/styles/ticket-detail/chain.ts
//
// 工单详情域：交接链、kind 色标与轨道。
// 类名与数值一律引用 styles/tokens.ts；本文件不定义新的设计变量。

export const TICKET_CHAIN_CSS = `

.pa-chain {
  --pa-kind: var(--dsw-alias-label-tertiary);
  border-bottom: var(--pa-border-width-thin) solid color-mix(in srgb, var(--dsw-alias-border-l1) 55%, transparent);
  border-radius: var(--pa-radius-sm);
}
.pa-chain:last-child {
  border-bottom: 0;
}
.pa-chain--selected {
  background: color-mix(in srgb, var(--dsw-alias-state-business-primary) 7.5%, transparent);
  box-shadow: inset 0 0 0 var(--pa-hairline) color-mix(in srgb, var(--dsw-alias-state-business-primary) 36%, transparent);
}
.pa-chain--affected {
  background: linear-gradient(90deg, color-mix(in srgb, var(--dsw-alias-state-business-primary) 7%, transparent), transparent 78%);
}
.pa-chain--affected .pa-chain__meta::before {
  content: '';
  flex: 0 0 2px;
  align-self: stretch;
  margin: var(--pa-space-6) 0;
  border-radius: var(--pa-radius-2);
  background: color-mix(in srgb, var(--dsw-alias-state-business-primary) 55%, transparent);
}
.pa-chain--dim {
  opacity: 0.26;
}
.pa-chain--expandable .pa-chain__row {
  cursor: pointer;
}
.pa-chain__row {
  display: grid;
  grid-template-columns: var(--pa-rail-w) minmax(0, 1fr);
  align-items: stretch;
  box-sizing: border-box;
  width: 100%;
  min-height: 32px;
  padding: 0;
  border: 0;
  border-radius: var(--pa-radius-sm);
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  transition: background-color var(--pa-duration-fast) var(--pa-ease-standard);
}
.pa-chain__row:hover {
  background: color-mix(in srgb, var(--dsw-alias-label-primary) 3%, transparent);
}
.pa-chain__row--static,
.pa-chain__row--live {
  cursor: default;
}
.pa-chain__row:focus-visible {
  outline: var(--pa-focus-ring);
  outline-offset: -1px;
}
.pa-chain--fan .pa-chain__row {
  min-height: 46px;
}
.pa-chain--milestone .pa-chain__row {
  min-height: 26px;
}
.pa-chain--live .pa-chain__row {
  min-height: 30px;
}
.pa-chain__rail {
  position: relative;
  display: block;
  min-width: 0;
  min-height: 0;
}
.pa-chain__rail svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
}
.pa-chain__meta {
  display: flex;
  align-items: center;
  gap: var(--pa-space-8);
  min-width: 0;
  padding-left: var(--pa-space-10);
  border-left: var(--pa-border-width-thin) solid color-mix(in srgb, var(--dsw-alias-label-primary) 4.5%, transparent);
}
.pa-chain__kind {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  height: var(--pa-tag-height);
  padding: 0 var(--pa-tag-padding-x);
  border: var(--pa-hairline) solid color-mix(in srgb, var(--pa-kind) 34%, transparent);
  border-radius: var(--pa-radius-xs);
  background: color-mix(in srgb, var(--pa-kind) 12%, transparent);
  color: var(--pa-kind);
  font-size: var(--pa-font-size-label);
  font-weight: var(--pa-font-weight-medium);
  line-height: var(--pa-line-height-16);
  white-space: nowrap;
}
.pa-chain__time {
  flex: 0 0 auto;
  margin-left: auto;
  color: var(--dsw-alias-label-tertiary);
  font-size: var(--pa-font-size-label);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  line-height: var(--pa-line-height-16);
}
.pa-chain--milestone .pa-chain__kind,
.pa-chain--live .pa-chain__kind {
  color: var(--dsw-alias-label-secondary);
  border-color: var(--dsw-alias-border-l2);
  background: color-mix(in srgb, var(--dsw-alias-label-primary) 4%, transparent);
}
.pa-chain--milestone.pa-kind-fail .pa-chain__kind {
  color: var(--pa-kind-fail-label);
  border-color: color-mix(in srgb, var(--pa-kind-fail) 35%, transparent);
  background: color-mix(in srgb, var(--pa-kind-fail) 9%, transparent);
}
.pa-kind-intervene .pa-chain__kind,
.pa-kind-intervene .pa-stream__kind {
  border-style: dashed;
}
.pa-chain--live .pa-chain__meta {
  border-left-color: transparent;
}
.pa-chain--live .pa-chain__time {
  color: var(--dsw-alias-label-caption);
}

.pa-chain__expand {
  margin: var(--pa-space-2) 0 var(--pa-space-7);
  padding: var(--pa-space-9) var(--pa-space-12) var(--pa-space-11);
  border: var(--pa-hairline) solid var(--dsw-alias-border-l2);
  border-left: var(--pa-border-width-emphasis) solid var(--pa-kind);
  border-radius: 0 var(--pa-radius-sm) var(--pa-radius-sm) 0;
  background: var(--dsw-alias-bg-layer-2);
}
.pa-chain__expand-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--pa-space-6);
  color: var(--dsw-alias-label-tertiary);
  font-size: var(--pa-font-size-label);
  line-height: var(--pa-line-height-16);
}
.pa-chain__who {
  overflow: hidden;
  color: var(--dsw-alias-label-secondary);
  font-family: var(--pa-font-family-mono);
  font-size: var(--pa-font-size-label);
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: var(--pa-line-height-16);
}
.pa-chain__arrow {
  display: inline-flex;
  align-items: center;
  color: var(--dsw-alias-label-caption);
  font-size: var(--pa-font-size-label);
  line-height: var(--pa-line-height-16);
}
.pa-chain__etime {
  color: var(--dsw-alias-label-caption);
  font-variant-numeric: tabular-nums;
}
.pa-chain__quote {
  margin: var(--pa-space-7) 0 0;
  color: var(--dsw-alias-label-secondary);
  font-size: var(--pa-font-size-caption);
  line-height: var(--pa-line-height-18);
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}
.pa-chain__quote p {
  margin: 0;
}
.pa-chain__targets {
  margin: var(--pa-space-4) 0 0;
  padding-left: var(--pa-space-16);
  color: var(--dsw-alias-label-secondary);
  font-size: var(--pa-font-size-label);
  line-height: var(--pa-line-height-16);
}
.pa-chain__options {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--pa-space-4);
  margin-top: var(--pa-space-7);
}
.pa-chain__options-label {
  color: var(--dsw-alias-label-tertiary);
  font-size: var(--pa-font-size-label);
  line-height: var(--pa-line-height-16);
}
.pa-chain__option {
  padding: 0 var(--pa-tag-padding-x);
  border: var(--pa-hairline) solid var(--dsw-alias-border-l2);
  border-radius: var(--pa-radius-xs);
  color: var(--dsw-alias-label-secondary);
  font-size: var(--pa-font-size-label);
  line-height: var(--pa-line-height-16);
  height: var(--pa-tag-height);
  display: inline-flex;
  align-items: center;
}
.pa-chain__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--pa-space-6);
  margin-top: var(--pa-space-9);
}
.pa-chain__action {
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
.pa-chain__action:hover {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}
.pa-rail__lane {
  stroke: color-mix(in srgb, var(--dsw-alias-label-primary) 6%, transparent);
  stroke-width: 1;
}
.pa-rail__edge {
  fill: none;
  stroke-width: 1.3;
  opacity: 0.9;
}
.pa-rail__source {
  stroke: var(--dsw-alias-bg-layer-1);
  stroke-width: 1.2;
}
.pa-rail__node {
  fill: var(--dsw-alias-bg-layer-1);
  stroke: var(--pa-kind);
  stroke-width: 1.4;
}
.pa-rail__node--dashed {
  stroke-dasharray: 2.5 2.5;
}
.pa-rail__milestone {
  fill: none;
  stroke: var(--dsw-alias-label-tertiary);
  stroke-width: 1.2;
}
.pa-rail__live-core {
  fill: var(--dsw-alias-state-success-primary);
}
.pa-rail__live-ring {
  fill: none;
  stroke: color-mix(in srgb, var(--dsw-alias-state-success-primary) 50%, transparent);
  stroke-width: 1;
  animation: pa-pulse var(--pa-duration-pulse) var(--pa-ease-out) infinite;
  transform-origin: center;
}
@keyframes pa-pulse {
  0% {
    opacity: 0.9;
  }
  70%,
  100% {
    opacity: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .pa-rail__live-ring {
    animation: none;
  }
}

.pa-kind-dispatch {
  --pa-kind: var(--pa-kind-dispatch);
}
.pa-kind-supplement {
  --pa-kind: var(--pa-kind-supplement);
}
.pa-kind-spawn {
  --pa-kind: var(--pa-kind-spawn);
}
.pa-kind-up {
  --pa-kind: var(--pa-kind-up);
}
.pa-kind-sync {
  --pa-kind: var(--pa-kind-sync);
}
.pa-kind-approval {
  --pa-kind: var(--pa-kind-approval);
}
.pa-kind-decision {
  --pa-kind: var(--pa-kind-decision);
}
.pa-kind-intervene {
  --pa-kind: var(--pa-kind-intervene);
}
.pa-kind-state {
  --pa-kind: var(--pa-kind-state);
}
.pa-kind-fail {
  --pa-kind: var(--pa-kind-fail);
}
`
