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
`
