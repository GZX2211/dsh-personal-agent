// src/client/styles/shell.ts
//
// 面板外壳：容器、标签条、正文、空态、跨页错误横幅。
// 类名与数值一律引用 styles/tokens.ts；本文件不定义新的设计变量。

export const SHELL_CSS = `
/* ── 面板骨架 ───────────────────────────────────────────────────────── */
.pa-console {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  color: inherit;
  font-size: var(--pa-font-size-body);
}
.pa-console__tabs {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: nowrap;
  gap: 0 var(--pa-tabs-gap);
  align-items: stretch;
  box-sizing: border-box;
  min-width: 0;
  min-height: var(--pa-tabs-height);
  padding: 0 var(--pa-tabs-padding-x);
  overflow-x: auto;
  scrollbar-width: none;
  border-bottom: var(--pa-hairline) solid var(--dsw-alias-border-l2);
}
.pa-console__tabs::-webkit-scrollbar {
  display: none;
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
  font-size: var(--pa-tabs-font-size);
  font-weight: var(--pa-tabs-font-weight);
  line-height: var(--pa-tabs-line-height);
  white-space: nowrap;
  cursor: pointer;
  transition: color var(--pa-duration-fast) var(--pa-ease-standard);
}
.pa-console__tab:hover {
  color: var(--dsw-alias-label-primary);
}
.pa-console__tab[aria-selected='true'] {
  color: var(--dsw-alias-label-primary);
}
.pa-console__tab:focus-visible {
  outline: var(--pa-focus-ring);
  outline-offset: 2px;
  border-radius: var(--pa-radius-2);
}
.pa-console__tab::after {
  content: '';
  position: absolute;
  right: 0;
  bottom: -1px;
  left: 0;
  height: var(--pa-tabs-underline-height);
  border-radius: var(--pa-radius-2) var(--pa-radius-2) 0 0;
  background: transparent;
}
.pa-console__tab[aria-selected='true']::after {
  background: var(--dsw-alias-label-primary);
}
.pa-console__count {
  margin-left: var(--pa-space-4);
}
.pa-console__body {
  position: relative;
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
}
.pa-console__empty {
  display: block;
  margin: auto;
  padding: var(--pa-space-24) var(--pa-space-16);
  color: var(--dsw-alias-label-tertiary);
  font-size: var(--pa-font-size-body);
  line-height: var(--pa-line-height-20);
  text-align: center;
}

/* ── 连接横幅与提交提示 ─────────────────────────────────────────────── */
.pa-banner {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: var(--pa-space-8);
  margin: 0 var(--pa-space-16) var(--pa-space-8);
  padding: var(--pa-space-6) var(--pa-space-10);
  border: var(--pa-hairline) solid var(--dsw-alias-state-error-primary);
  border-radius: var(--dsw-radius-sm);
  color: var(--dsw-alias-state-error-primary);
  font-size: var(--pa-font-size-caption);
  line-height: var(--pa-line-height-18);
}
.pa-banner__retry {
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-decoration: underline;
  cursor: pointer;
}
`
