// src/client/styles/settings/form.ts
//
// 设置域：卡片、字段、下拉、文本域、编辑器、保存条与历史。
// 类名与数值一律引用 styles/tokens.ts；本文件不定义新的设计变量。

export const SETTINGS_FORM_CSS = `
/* ── 设置页：窄区域单列卡片 ─────────────────────────────────────────── */
.pa-settings {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  box-sizing: border-box;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}
.pa-settings__body {
  display: flex;
  flex-direction: column;
  gap: var(--pa-space-10);
  box-sizing: border-box;
  padding: var(--pa-space-10) var(--pa-space-16) var(--pa-space-16);
}
.pa-settings__section {
  display: flex;
  flex-direction: column;
  gap: var(--pa-space-10);
  min-width: 0;
}
.pa-settings__card {
  display: flex;
  flex-direction: column;
  gap: var(--pa-space-8);
  box-sizing: border-box;
  min-width: 0;
  padding: var(--pa-space-10) var(--pa-space-12);
  border: var(--pa-hairline) solid var(--dsw-alias-border-l2);
  border-radius: var(--dsw-radius-lg);
  background: var(--dsw-alias-bg-layer-1);
}
.pa-settings__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--pa-space-8);
  min-width: 0;
}
.pa-settings__title {
  margin: 0;
  color: var(--dsw-alias-label-primary);
  font-size: var(--pa-font-size-title);
  font-weight: var(--pa-font-weight-medium);
  line-height: var(--pa-line-height-22);
}
.pa-settings__meta {
  margin: 0;
  color: var(--dsw-alias-label-tertiary);
  font-size: var(--pa-font-size-caption);
  line-height: var(--pa-line-height-18);
  overflow-wrap: anywhere;
}
.pa-settings__help {
  margin: 0;
  color: var(--dsw-alias-label-secondary);
  font-size: var(--pa-font-size-caption);
  line-height: var(--pa-line-height-18);
  overflow-wrap: anywhere;
}
.pa-settings__empty {
  margin: 0;
  padding: var(--pa-space-8) 0;
  color: var(--dsw-alias-label-tertiary);
  font-size: var(--pa-font-size-body);
  line-height: var(--pa-line-height-20);
  text-align: center;
}
.pa-settings__error {
  margin: 0;
  color: var(--dsw-alias-state-error-primary);
  font-size: var(--pa-font-size-caption);
  line-height: var(--pa-line-height-18);
  overflow-wrap: anywhere;
}
.pa-settings__fields {
  display: flex;
  flex-direction: column;
  gap: var(--pa-space-8);
}
.pa-settings__field {
  display: flex;
  flex-direction: column;
  gap: var(--pa-space-4);
  min-width: 0;
}
.pa-settings__label {
  color: var(--dsw-alias-label-primary);
  font-size: var(--pa-font-size-body);
  line-height: var(--pa-line-height-20);
}
.pa-settings__select {
  box-sizing: border-box;
  width: 100%;
  height: var(--pa-control-height-lg);
  padding: 0 var(--pa-space-12);
  border: var(--pa-hairline) solid var(--dsw-alias-border-l4);
  border-radius: var(--dsw-radius-md);
  /* 与官方设置字段同色：bg-overlay 在深色主题里接近白，长时间阅读非常刺眼。 */
  background: var(--dsw-alias-bg-layer-3);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: var(--pa-font-size-body);
}
.pa-settings__select:focus {
  border-color: var(--dsw-alias-state-business-primary);
  outline: none;
}
.pa-settings__select:disabled {
  color: var(--dsw-alias-label-caption);
}
.pa-settings__textarea {
  box-sizing: border-box;
  width: 100%;
  min-height: 56px;
  padding: var(--pa-space-6) var(--pa-space-12);
  border: var(--pa-hairline) solid var(--dsw-alias-border-l4);
  border-radius: var(--dsw-radius-md);
  /* 官方 ConfigField 的输入面：比卡片亮一档的深灰，不是浮层白。 */
  background: var(--dsw-alias-bg-layer-3);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: var(--pa-font-size-body);
  line-height: var(--pa-line-height-20);
  resize: vertical;
}
.pa-settings__textarea:focus {
  border-color: var(--dsw-alias-state-business-primary);
  outline: none;
}
.pa-settings__editor {
  min-height: 260px;
  font-family: var(--pa-font-family-mono);
  font-size: var(--pa-font-size-caption);
  line-height: var(--pa-line-height-18);
}
.pa-settings__pre {
  box-sizing: border-box;
  max-height: 320px;
  margin: 0;
  padding: var(--pa-space-8) var(--pa-space-12);
  overflow: auto;
  border: var(--pa-hairline) solid var(--dsw-alias-border-l4);
  border-radius: var(--dsw-radius-md);
  background: var(--dsw-alias-bg-layer-3);
  color: var(--dsw-alias-label-primary);
  font-family: var(--pa-font-family-mono);
  font-size: var(--pa-font-size-caption);
  line-height: var(--pa-line-height-18);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.pa-settings__pre ins {
  color: var(--dsw-alias-state-success-primary);
  text-decoration: none;
  background: color-mix(in srgb, currentColor 12%, transparent);
}
.pa-settings__pre del {
  color: var(--dsw-alias-state-error-primary);
  text-decoration: line-through;
  background: color-mix(in srgb, currentColor 12%, transparent);
}
.pa-settings__diff-fold {
  color: var(--dsw-alias-label-tertiary);
}
.pa-settings__savebar {
  position: sticky;
  bottom: 0;
  z-index: var(--pa-z-savebar);
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--pa-space-8);
  box-sizing: border-box;
  /* 长表单滚动时保存动作始终在手边；底色与面板一致，不额外画框。 */
  padding: var(--pa-space-8) var(--pa-space-12);
  background: var(--dsw-alias-bg-base, transparent);
}
.pa-settings__savebar .pa-settings__error {
  margin-right: auto;
}
.pa-settings__history {
  display: flex;
  flex-direction: column;
  gap: var(--pa-space-8);
}
.pa-settings__history-item {
  display: flex;
  flex-direction: column;
  gap: var(--pa-space-4);
  padding: var(--pa-space-8) 0;
  border-top: var(--pa-hairline) solid var(--dsw-alias-border-l1);
}
.pa-settings__history-item:first-child {
  padding-top: 0;
  border-top: 0;
}
.pa-settings__history-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--pa-space-8);
}
.pa-settings__history-actions {
  display: flex;
  gap: var(--pa-space-8);
}
@media (max-width: 520px) {
  .pa-settings__body {
    padding: var(--pa-space-8) var(--pa-space-12) var(--pa-space-12);
  }
  .pa-settings__history-head {
    flex-direction: column;
    gap: var(--pa-space-2);
  }
}
`
