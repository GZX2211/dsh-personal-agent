// src/client/styles/settings/policy.ts
//
// 设置域：策略版本条、规则列表与规则编辑行。
// 类名与数值一律引用 styles/tokens.ts；本文件不定义新的设计变量。

export const SETTINGS_POLICY_CSS = `
/* ── 策略：统一版本条与折叠规则行 ─────────────────────────────────── */
.pa-policy__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--pa-space-6) var(--pa-space-12);
  padding: 0 var(--pa-space-2);
}
.pa-policy__hint {
  margin: 0;
  color: var(--dsw-alias-label-tertiary);
  font-size: var(--pa-font-size-caption);
  line-height: var(--pa-line-height-18);
  overflow-wrap: anywhere;
}
.pa-policy__version {
  flex: none;
  padding: var(--pa-space-1) var(--pa-space-8);
  border: var(--pa-hairline) solid var(--dsw-alias-border-l2);
  border-radius: var(--pa-radius-pill);
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-secondary);
  font-size: var(--pa-font-size-caption);
  line-height: var(--pa-line-height-18);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.pa-rules {
  gap: var(--pa-space-6);
}
.pa-rules__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--pa-space-8);
  min-width: 0;
}
.pa-rules__heading {
  display: flex;
  align-items: center;
  gap: var(--pa-space-6);
  min-width: 0;
}
.pa-rules__count {
  flex: none;
  min-width: 18px;
  padding: 0 var(--pa-space-5);
  border-radius: var(--pa-radius-pill);
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-tertiary);
  font-size: var(--pa-font-size-label);
  line-height: var(--pa-line-height-16);
  text-align: center;
  font-variant-numeric: tabular-nums;
}
.pa-rules__add {
  flex: none;
}
.pa-rules__empty {
  margin: 0;
  padding: var(--pa-space-14) var(--pa-space-12);
  border: var(--pa-hairline) dashed var(--dsw-alias-border-l3);
  border-radius: var(--dsw-radius-md);
  color: var(--dsw-alias-label-tertiary);
  font-size: var(--pa-font-size-caption);
  line-height: var(--pa-line-height-18);
  text-align: center;
}
.pa-rules__list {
  display: flex;
  flex-direction: column;
  margin-top: var(--pa-space-2);
}
.pa-rule {
  border-top: var(--pa-hairline) solid var(--dsw-alias-border-l1);
}
.pa-rule:first-child {
  border-top: 0;
}
.pa-rule[data-open] {
  margin: var(--pa-space-2) 0;
  border-top-color: transparent;
  border-radius: var(--dsw-radius-md);
  background: var(--dsw-alias-bg-layer-2);
}
.pa-rule[data-open] + .pa-rule {
  border-top-color: transparent;
}
.pa-rule__header {
  display: flex;
  align-items: center;
  gap: var(--pa-space-6);
  min-width: 0;
}
.pa-rule__toggle {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  gap: var(--pa-space-8);
  min-width: 0;
  height: var(--pa-control-height-lg);
  padding: 0 var(--pa-space-4) 0 var(--pa-space-6);
  border: 0;
  border-radius: var(--dsw-radius-sm);
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
@media (hover: hover) {
  .pa-rule__toggle:hover {
    background: var(--dsw-alias-interactive-bg-hover);
  }
}
.pa-rule__toggle:focus-visible {
  outline: var(--pa-focus-ring);
  outline-offset: -1px;
}
.pa-rule__dot {
  flex: none;
  width: var(--pa-dot-size-lg);
  height: var(--pa-dot-size-lg);
  border-radius: var(--pa-radius-circle);
  background: transparent;
  box-shadow: inset 0 0 0 var(--pa-border-width-1-5) var(--dsw-alias-label-tertiary);
}
.pa-rule__dot[data-enabled='true'] {
  background: var(--dsw-alias-state-success-primary);
  box-shadow: none;
}
.pa-rule[data-invalid] .pa-rule__dot {
  background: var(--dsw-alias-state-error-primary);
  box-shadow: none;
}
.pa-rule__name {
  flex: 0 0 auto;
  min-width: 0;
  max-width: 50%;
  overflow: hidden;
  color: var(--dsw-alias-label-primary);
  font-size: var(--pa-font-size-body);
  font-weight: var(--pa-font-weight-medium);
  line-height: var(--pa-line-height-20);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pa-rule__name[data-empty] {
  color: var(--dsw-alias-label-tertiary);
  font-weight: var(--pa-font-weight-regular);
}
.pa-rule[data-disabled] .pa-rule__name {
  color: var(--dsw-alias-label-secondary);
}
.pa-rule__preview {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  color: var(--dsw-alias-label-tertiary);
  font-size: var(--pa-font-size-caption);
  line-height: var(--pa-line-height-18);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pa-rule__preview[data-empty] {
  color: var(--dsw-alias-label-caption);
}
.pa-rule__preview[data-error] {
  color: var(--dsw-alias-state-error-primary);
}
.pa-rule__chevron {
  flex: none;
  width: var(--pa-icon-size-md);
  height: var(--pa-icon-size-md);
  color: var(--dsw-alias-label-tertiary);
  transition: transform var(--pa-duration-fast) var(--pa-ease-standard);
}
.pa-rule[data-open] .pa-rule__chevron {
  transform: rotate(180deg);
}
.pa-rule__switch {
  flex: none;
  margin-right: var(--pa-space-2);
}
.pa-rule__body {
  display: flex;
  flex-direction: column;
  gap: var(--pa-space-8);
  padding: var(--pa-space-4) var(--pa-space-10) var(--pa-space-10) var(--pa-space-22);
}
.pa-rule__input {
  display: flex;
  box-sizing: border-box;
  width: 100%;
  background: var(--dsw-alias-bg-layer-3);
}
.pa-rule__textarea {
  min-height: 72px;
}
.pa-rule__footer {
  display: flex;
  align-items: center;
  margin-top: var(--pa-space-2);
}
.pa-settings__card .pa-rule__remove {
  color: var(--dsw-alias-state-error-primary);
}
@media (hover: hover) {
  .pa-settings__card .pa-rule__remove:hover:not(:disabled) {
    background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 10%, transparent);
  }
}
@media (max-width: 420px) {
  .pa-rule__name {
    max-width: 42%;
  }
  .pa-rule__body {
    padding-left: var(--pa-space-10);
  }
}
`
