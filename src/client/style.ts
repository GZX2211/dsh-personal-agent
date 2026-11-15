// src/client/style.ts
//
// 面板样式：只做隔离与布局，取宿主的别名 token，不复制设计变量。
// 标签条的度量与宿主会话视图标签一致（13px/500、64px 间距空隙 32px、2px
// 下划线取业务蓝），这样它和「对话 / 轨迹」那一排看起来是同一套东西。
// 审批卡片的边框、圆角与阴影对齐宿主官方审批卡片（warn 边框 + radius-xl）。

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

.pa-filterbar {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.pa-filterbar__segments {
  display: inline-flex;
  overflow: hidden;
  border: 0.5px solid var(--dsw-alias-border-l3);
  border-radius: 6px;
}
.pa-filterbar__segment {
  padding: 3px 10px;
  border: 0;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 12px;
  line-height: 18px;
  white-space: nowrap;
  cursor: pointer;
}
.pa-filterbar__segment + .pa-filterbar__segment {
  border-left: 0.5px solid var(--dsw-alias-border-l3);
}
.pa-filterbar__segment:hover {
  color: var(--dsw-alias-label-primary);
}
.pa-filterbar__segment[aria-selected='true'] {
  background: color-mix(in srgb, var(--dsw-alias-state-business-primary) 12%, transparent);
  color: var(--dsw-alias-state-business-primary);
}
.pa-filterbar__search {
  box-sizing: border-box;
  width: 168px;
  min-width: 0;
  padding: 3px 8px;
  border: 0.5px solid var(--dsw-alias-border-l3);
  border-radius: 6px;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 12px;
  line-height: 18px;
}
.pa-filterbar__search::placeholder {
  color: var(--dsw-alias-label-tertiary);
}

.pa-approvals,
.pa-tickets {
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
  overflow: hidden;
  border: 1px solid var(--dsw-alias-state-warn-secondary);
  border-radius: var(--dsw-radius-xl);
  background: var(--dsw-specific-input-major);
  box-shadow: var(--dsw-shadow-lv2);
}
.pa-approval[data-readonly] {
  border-color: var(--dsw-alias-border-l3);
  background: transparent;
  box-shadow: none;
}
.pa-approval__head {
  display: flex;
  flex-direction: column;
  gap: 4px;
  box-sizing: border-box;
  width: 100%;
  padding: 10px 14px;
  border: 0;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.pa-approval__headline {
  display: flex;
  gap: 8px;
  align-items: center;
}
.pa-approval__title {
  flex: 1 1 auto;
  font-size: 15px;
  font-weight: 500;
  line-height: 24px;
}
.pa-approval__state {
  flex: 0 0 auto;
  padding: 0 6px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--dsw-alias-state-business-primary) 12%, transparent);
  color: var(--dsw-alias-state-business-primary);
  font-size: 11px;
  line-height: 18px;
}
.pa-approval__chevron {
  flex: 0 0 auto;
  width: 7px;
  height: 7px;
  margin-right: 2px;
  border-right: 1.5px solid var(--dsw-alias-label-tertiary);
  border-bottom: 1.5px solid var(--dsw-alias-label-tertiary);
  transform: rotate(45deg);
  transition: transform 0.15s ease;
}
.pa-approval__chevron[data-expanded] {
  transform: rotate(-135deg);
}
.pa-approval__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0 10px;
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  line-height: 18px;
}
.pa-approval__risk--high {
  color: var(--dsw-alias-state-error-primary);
}
.pa-approval__preview {
  overflow: hidden;
  color: var(--dsw-alias-label-secondary);
  font-size: 13px;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pa-approval__body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 0 14px 14px;
  color: var(--dsw-alias-label-secondary);
}
.pa-approval__question {
  margin: 0;
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
  line-height: 20px;
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
  line-height: 18px;
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
.pa-approval__decision {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 10px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--dsw-alias-state-business-primary) 8%, transparent);
}
.pa-approval__decision-value {
  margin: 0;
  color: var(--dsw-alias-label-primary);
  font-weight: 500;
}
.pa-approval__decision-note {
  margin: 0;
  color: var(--dsw-alias-label-secondary);
  white-space: pre-wrap;
}
.pa-approval__decision-time {
  margin: 0;
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
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
  background: color-mix(in srgb, var(--dsw-alias-state-business-primary) 12%, transparent);
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

.pa-ticket {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 14px;
  border: 0.5px solid var(--dsw-alias-border-l3);
  border-radius: 8px;
  background: var(--dsw-specific-input-major);
}
.pa-ticket__head {
  display: flex;
  gap: 8px;
  align-items: baseline;
}
.pa-ticket__stage {
  flex: 0 0 auto;
  padding: 0 6px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--dsw-alias-label-tertiary) 14%, transparent);
  color: var(--dsw-alias-label-secondary);
  font-size: 11px;
  line-height: 18px;
}
.pa-ticket[data-stage='running'] .pa-ticket__stage,
.pa-ticket[data-stage='blocked'] .pa-ticket__stage {
  background: color-mix(in srgb, var(--dsw-alias-state-business-primary) 12%, transparent);
  color: var(--dsw-alias-state-business-primary);
}
.pa-ticket[data-stage='blocked'] .pa-ticket__stage {
  background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 14%, transparent);
  color: var(--dsw-alias-state-warn-primary);
}
.pa-ticket__title {
  flex: 1 1 auto;
  overflow: hidden;
  color: var(--dsw-alias-label-primary);
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pa-ticket__time {
  flex: 0 0 auto;
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
}
.pa-ticket__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0 10px;
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  line-height: 18px;
}
.pa-ticket__preview {
  display: -webkit-box;
  overflow: hidden;
  margin: 0;
  color: var(--dsw-alias-label-secondary);
  font-size: 13px;
  line-height: 20px;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
.pa-ticket__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.pa-ticket__tag {
  padding: 0 6px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 14%, transparent);
  color: var(--dsw-alias-state-warn-primary);
  font-size: 11px;
  line-height: 18px;
}
.pa-ticket[data-outcome='completed'] .pa-ticket__tag {
  background: color-mix(in srgb, var(--dsw-alias-state-business-primary) 12%, transparent);
  color: var(--dsw-alias-state-business-primary);
}
.pa-ticket[data-outcome='failed'] .pa-ticket__tag {
  background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 12%, transparent);
  color: var(--dsw-alias-state-error-primary);
}
`
