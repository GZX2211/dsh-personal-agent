// src/client/style.ts
//
// 面板样式：只做隔离与布局，取宿主的别名 token，不复制设计变量。
// 标签条的度量与宿主会话视图标签一致（13px/500、64px 间距空隙 32px、2px
// 下划线取业务蓝），这样它和「对话 / 轨迹」那一排看起来是同一套东西。

export const CONSOLE_CSS = `
.pa-console {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  height: 100%;
  min-height: 0;
  color: inherit;
  font-size: 13px;
}
.pa-console__tabs {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  gap: 0 32px;
  align-items: stretch;
  box-sizing: border-box;
  min-height: 38px;
  padding: 0 16px;
  border-bottom: 0.5px solid var(--dsw-alias-border-l3);
}
.pa-console__tab {
  position: relative;
  display: inline-flex;
  align-items: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--dsw-alias-label-tertiary);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  line-height: 16px;
  white-space: nowrap;
  cursor: pointer;
}
.pa-console__tab:hover {
  color: var(--dsw-alias-label-secondary);
}
.pa-console__tab[aria-selected='true'] {
  color: var(--dsw-alias-state-business-primary);
}
.pa-console__tab::after {
  content: '';
  position: absolute;
  right: 0;
  bottom: -1px;
  left: 0;
  height: 2px;
  border-radius: 2px;
  background: transparent;
}
.pa-console__tab[aria-selected='true']::after {
  background: var(--dsw-alias-state-business-primary);
}
.pa-console__badge {
  margin-left: 3px;
  color: var(--dsw-alias-state-error-primary);
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  vertical-align: super;
}
.pa-console__body {
  flex: 1 1 auto;
  min-height: 0;
  padding: 12px 16px;
  overflow: auto;
}
.pa-console__empty {
  color: var(--dsw-alias-label-tertiary);
}
.pa-console__placeholder {
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: var(--dsw-alias-label-secondary);
}
.pa-console__placeholder strong {
  color: var(--dsw-alias-label-primary);
  font-weight: 600;
}
.pa-approvals {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.pa-approvals__banner {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 6px 8px;
  border: 0.5px solid var(--dsw-alias-state-error-primary);
  border-radius: 6px;
  color: var(--dsw-alias-state-error-primary);
}
.pa-approvals__retry,
.pa-approval__secondary {
  padding: 2px 8px;
  border: 0.5px solid var(--dsw-alias-border-l3);
  border-radius: 6px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  cursor: pointer;
}
.pa-approvals__notice {
  margin: 0;
  color: var(--dsw-alias-state-business-primary);
}
.pa-approval {
  border: 0.5px solid var(--dsw-alias-border-l3);
  border-radius: 8px;
  overflow: hidden;
}
.pa-approval__head {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
  padding: 8px 10px;
  border: 0;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.pa-approval__title {
  font-weight: 600;
}
.pa-approval__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
}
.pa-approval__risk--high {
  color: var(--dsw-alias-state-error-primary);
}
.pa-approval__body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 0 10px 10px;
  color: var(--dsw-alias-label-secondary);
}
.pa-approval__question {
  margin: 0;
  color: var(--dsw-alias-label-primary);
  white-space: pre-wrap;
}
.pa-approval__options {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.pa-approval__option {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  cursor: pointer;
}
.pa-approval__option-text {
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.pa-approval__option-desc {
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
}
.pa-approval__section-title {
  color: var(--dsw-alias-label-primary);
  font-weight: 500;
}
.pa-approval__note {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.pa-approval__note-input,
.pa-approval__field input,
.pa-approval__field textarea {
  box-sizing: border-box;
  width: 100%;
  padding: 5px 8px;
  border: 0.5px solid var(--dsw-alias-border-l3);
  border-radius: 6px;
  background: transparent;
  color: inherit;
  font: inherit;
  resize: vertical;
}
.pa-approval__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 6px;
}
.pa-approval__field--boolean {
  flex-direction: row-reverse;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
}
.pa-approval__field--boolean input {
  width: auto;
}
.pa-approval__hint {
  margin: 0;
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
}
.pa-approval__error {
  margin: 0;
  color: var(--dsw-alias-state-error-primary);
}
.pa-approval__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.pa-approval__primary {
  padding: 4px 12px;
  border: 0.5px solid var(--dsw-alias-state-business-primary);
  border-radius: 6px;
  background: transparent;
  color: var(--dsw-alias-state-business-primary);
  font: inherit;
  font-weight: 500;
  cursor: pointer;
}
.pa-approval__primary:disabled,
.pa-approval__secondary:disabled,
.pa-approvals__retry:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
`
