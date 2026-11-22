// src/client/styles/shared.ts
//
// 列表页通用骨架：过滤条、帮助、列表容器与行、跨域动效降级。
// 类名与数值一律引用 styles/tokens.ts；本文件不定义新的设计变量。

export const SHARED_CSS = `
/* ── 过滤条：官方 Pill / Input 只负责摆放 ───────────────────────────── */
.pa-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--pa-space-8);
  flex: 0 0 auto;
  padding: var(--pa-space-8) var(--pa-space-16);
}
.pa-toolbar__filters {
  display: flex;
  align-items: center;
  gap: var(--pa-space-2);
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
}
.pa-toolbar__filters::-webkit-scrollbar {
  display: none;
}
.pa-toolbar__tools {
  display: flex;
  flex: 0 1 auto;
  align-items: center;
  gap: var(--pa-space-4);
  min-width: 0;
}
.pa-toolbar__search {
  flex: 0 1 auto;
  width: 180px;
  max-width: 200px;
  min-width: 120px;
  height: var(--pa-control-height-sm);
  border-radius: var(--dsw-radius-sm);
}
/* 官方 Input 默认 14/32；工具条里收一档，与 24px 的 Pill 同一行不抢视线。 */
.pa-toolbar__search input {
  font-size: var(--pa-font-size-body);
  line-height: var(--pa-line-height-18);
}
.pa-toolbar__search svg {
  width: var(--pa-icon-size-sm);
  height: var(--pa-icon-size-sm);
}
.pa-toolbar__help {
  flex: 0 0 auto;
}
/* 下拉筛选：官方 Button 做触发，尾随一个箭头；两个下拉之间留一点呼吸。 */
.pa-filter-menu__trigger + .pa-filter-menu__trigger {
  margin-left: var(--pa-space-6);
}
.pa-filter-menu__value {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pa-filter-menu__chevron {
  display: inline-flex;
  flex: 0 0 auto;
  width: var(--pa-icon-size-sm);
  height: var(--pa-icon-size-sm);
  margin-left: var(--pa-space-4);
  color: var(--dsw-alias-label-tertiary);
}
.pa-help-text {
  margin: 0 0 var(--pa-space-8);
  color: var(--dsw-alias-label-secondary);
  font-size: var(--pa-font-size-body);
  line-height: var(--pa-line-height-20);
}
.pa-help-text:last-of-type {
  margin-bottom: 0;
}
/* 双写类名，保证在宿主 Modal 样式之后加载时仍能给出适合说明文字的宽度。 */
.pa-help-dialog.pa-help-dialog {
  width: min(480px, 100%);
}

/* ── 列表：官方 AnimatedRows 容器 + 共用的列表行 ─────────────────────── */
.pa-list {
  position: relative;
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: var(--pa-space-2);
  box-sizing: border-box;
  min-height: 0;
  margin: 0 var(--pa-space-16) var(--pa-space-16);
  padding: var(--pa-space-4);
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  border: var(--pa-hairline) solid var(--dsw-alias-border-l2);
  border-radius: var(--dsw-radius-lg);
  background: var(--dsw-alias-bg-layer-1);
}
.pa-row {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  box-sizing: border-box;
  min-width: 0;
  border-radius: var(--dsw-radius-md);
  transition: background-color var(--pa-duration-fast) var(--pa-ease-standard);
}
@media (hover: hover) {
  .pa-row:hover {
    background: var(--dsw-alias-interactive-bg-hover);
  }
}
.pa-row__head {
  display: flex;
  align-items: flex-start;
  gap: var(--pa-space-8);
  min-width: 0;
  padding: var(--pa-space-10) var(--pa-space-12);
}
.pa-row__body {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: var(--pa-space-2);
  min-width: 0;
}
.pa-row__titleline {
  display: flex;
  align-items: center;
  gap: var(--pa-space-8);
  min-width: 0;
}
.pa-row__title {
  flex: 1 1 auto;
  min-width: 0;
  margin: 0;
  overflow: hidden;
  color: var(--dsw-alias-label-primary);
  font-size: var(--pa-font-size-title);
  font-weight: var(--pa-font-weight-medium);
  line-height: var(--pa-line-height-22);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pa-row__time {
  margin-left: auto;
  color: var(--dsw-alias-label-tertiary);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
/* 标题行里的时间：紧跟状态徽标，不再占满剩余宽度。 */
.pa-row__time--inline {
  margin-left: 0;
}
.pa-row__summary {
  margin: 0;
  overflow: hidden;
  color: var(--dsw-alias-label-secondary);
  font-size: var(--pa-font-size-body);
  line-height: var(--pa-line-height-20);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pa-row__footer {
  display: flex;
  align-items: center;
  gap: var(--pa-space-8);
  min-height: 28px;
  margin-top: var(--pa-space-2);
  min-width: 0;
}
.pa-row__session {
  flex: 0 0 auto;
}
.pa-row__ref {
  flex: 0 0 auto;
}
.pa-row__aside {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: var(--pa-space-4);
}
.pa-row__status {
  flex: 0 0 auto;
}
.pa-row__toggle {
  width: 28px;
  min-width: 28px;
  padding: 0;
  flex: 0 0 auto;
  color: var(--dsw-alias-label-tertiary);
}
.pa-row__toggle:hover:not(:disabled) {
  color: var(--dsw-alias-label-primary);
}
.pa-row__toggle svg {
  transition: transform var(--pa-duration-fast) var(--pa-ease-standard);
}
.pa-row__toggle[aria-expanded='true'] svg {
  transform: rotate(180deg);
}
.pa-row__detail {
  min-width: 0;
  padding: 0 var(--pa-space-12) var(--pa-space-12);
}

@media (max-width: 520px) {
  .pa-toolbar {
    align-items: stretch;
  }
  .pa-toolbar__tools {
    width: 100%;
  }
  .pa-toolbar__search {
    width: auto;
    max-width: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .pa-row,
  .pa-detail__option,
  .pa-detail__answer,
  .pa-row__toggle svg,
  .pa-console__tab,
  .pa-thread,
  .pa-signal {
    transition: none;
  }
}
/* ── 工单详情：交接时间线（540px 右侧栏） ───────────────────────────── */
.pa-console__notice {
  flex: 0 0 auto;
  margin: var(--pa-space-8) var(--pa-space-16) 0;
  padding: var(--pa-space-6) var(--pa-space-9);
  border: var(--pa-hairline) solid var(--dsw-alias-state-warn-primary);
  border-radius: var(--dsw-radius-sm);
  background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 8%, transparent);
  color: var(--dsw-alias-state-warn-label);
  font-size: var(--pa-font-size-label);
  line-height: var(--pa-line-height-16);
}

.pa-row--interactive {
  cursor: pointer;
  outline: none;
}
.pa-row--interactive:focus-visible {
  outline: var(--pa-focus-ring);
  outline-offset: -1px;
}
`
