// src/client/style.ts
//
// 面板样式：颜色/圆角/字号/阴影一律取宿主 design token，不复制设计变量。
//
// 排版跟宿主主界面同一套刻度，这是本文件的第一原则：
//   · 字号：14 正文 / 13 次要 / 12 小字与时间 / 11 徽标
//   · 行高：22 正文 / 20 次要 / 16 小字与徽标
//   · 间距：2 / 4 / 8 / 12 / 14，全部沿同一条左基线（卡片内边距 14px）
// 因此卡片里任何一块都不再各带左右留白——各区块自己加左内边距，正是上一版
// 「文字对不齐、边距不一致」的根源。
//
// 卡片仍是官方 `ask_user_question` 提问卡的结构（头部 / 题干 / 选项 / 回答 /
// 附件 / 页脚），只是度量收敛到上面这套刻度。
//
// 构建链路没有 CSS Module 管线（客户端产物是单个 CJS 文件），因此样式集中
// 在本文件；类名用 `pa-` 前缀隔离，避免与宿主样式串味。

export const CONSOLE_CSS = `
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
  font-size: 13px;
}
.pa-console__tabs {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: nowrap;
  gap: 0 32px;
  align-items: stretch;
  box-sizing: border-box;
  min-width: 0;
  min-height: 38px;
  padding: 0 16px;
  overflow-x: auto;
  scrollbar-width: none;
  border-bottom: 0.5px solid var(--dsw-alias-border-l3);
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
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  min-width: 16px;
  height: 16px;
  margin-left: 4px;
  padding: 0 4px;
  border-radius: 999px;
  background: var(--dsw-alias-state-error-primary);
  color: var(--dsw-alias-label-primary-inverted);
  font-size: 11px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  line-height: 16px;
  white-space: nowrap;
}
.pa-console__body {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
}
.pa-console__empty {
  padding: 20px 16px;
  color: var(--dsw-alias-label-tertiary);
  font-size: 13px;
  line-height: 20px;
  text-align: center;
}
.pa-console__placeholder {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 16px;
  font-size: 13px;
  line-height: 20px;
  color: var(--dsw-alias-label-secondary);
}
.pa-console__placeholder strong {
  color: var(--dsw-alias-label-primary);
  font-weight: 500;
}

/* ── 过滤条 ─────────────────────────────────────────────────────────── */
.pa-filterbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex: 0 0 auto;
  padding: 8px 16px;
}
.pa-filterbar__capsules {
  display: flex;
  align-items: center;
  gap: 2px;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
}
.pa-filterbar__capsules::-webkit-scrollbar {
  display: none;
}
/* 胶囊用 flex 居中，不靠 line-height 撑高度——上下留白才会一致。 */
.pa-capsule {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  height: 24px;
  padding: 0 10px;
  border: 0;
  border-radius: var(--dsw-radius-sm);
  background: transparent;
  color: var(--dsw-alias-label-tertiary);
  font: inherit;
  font-size: 13px;
  font-weight: 400;
  line-height: 16px;
  white-space: nowrap;
  cursor: pointer;
}
.pa-capsule:hover {
  color: var(--dsw-alias-label-secondary);
}
.pa-capsule[aria-pressed='true'] {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
  font-weight: 500;
}
.pa-filterbar__tools {
  position: relative;
  display: flex;
  flex: 0 1 auto;
  align-items: center;
  gap: 4px;
  min-width: 0;
}
.pa-search {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  gap: 6px;
  box-sizing: border-box;
  height: 28px;
  min-width: 120px;
  max-width: 220px;
  padding: 0 8px;
  border-radius: var(--dsw-radius-sm);
  background: var(--dsw-alias-bg-layer-1);
  box-shadow: var(--dsw-elevation-soft);
  --dsw-elevation-stroke-color: var(--dsw-alias-border-l3);
}
.pa-search__icon {
  display: inline-flex;
  flex: 0 0 auto;
  color: var(--dsw-alias-label-tertiary);
}
.pa-search__input {
  flex: 1 1 auto;
  min-width: 0;
  border: 0;
  outline: none;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 13px;
  line-height: 16px;
}
.pa-search__input::placeholder {
  color: var(--dsw-alias-label-caption);
}
.pa-help {
  display: flex;
  flex: 0 0 auto;
}
.pa-help-pop {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 10;
  box-sizing: border-box;
  width: 240px;
  padding: 10px 12px;
  border-radius: var(--dsw-radius-md);
  background: var(--dsw-alias-bg-layer-2);
  box-shadow: var(--dsw-elevation-prominent);
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  line-height: 18px;
}
.pa-help-pop strong {
  display: block;
  margin-bottom: 4px;
  color: var(--dsw-alias-label-primary);
  font-size: 12px;
  font-weight: 500;
  line-height: 16px;
}
.pa-help-pop p {
  margin: 0 0 4px;
}
.pa-help-pop p:last-of-type {
  margin-bottom: 8px;
}
.pa-help-pop__close {
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 10px;
  border: 0.5px solid var(--dsw-alias-border-l3);
  border-radius: var(--dsw-radius-sm);
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 12px;
  line-height: 16px;
  cursor: pointer;
}

/* ── 列表与横幅 ─────────────────────────────────────────────────────── */
.pa-list {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 8px;
  box-sizing: border-box;
  min-height: 0;
  padding: 4px 16px 16px;
  overflow-y: auto;
  overscroll-behavior: contain;
}
.pa-banner {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 8px;
  margin: 0 16px 8px;
  padding: 6px 10px;
  border: 0.5px solid var(--dsw-alias-state-error-primary);
  border-radius: var(--dsw-radius-sm);
  color: var(--dsw-alias-state-error-primary);
  font-size: 12px;
  line-height: 16px;
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
.pa-notice {
  margin: 0;
  padding: 0 16px 8px;
  color: var(--dsw-alias-state-business-primary);
  font-size: 12px;
  line-height: 16px;
}

/* ── 卡片外壳 ───────────────────────────────────────────────────────── */
.pa-card {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  box-sizing: border-box;
  width: 100%;
  padding: 12px 14px;
  border: 0;
  border-radius: var(--dsw-radius-md);
  background: var(--dsw-specific-input-major);
  box-shadow: var(--dsw-elevation-soft);
  color: var(--dsw-alias-label-primary);
  --dsw-elevation-stroke-color: var(--dsw-alias-border-l2);
}
.pa-card,
.pa-card * {
  box-sizing: border-box;
}

/* ── 卡片头部：一行元信息 + 右侧状态/时间/折叠 ──────────────────────── */
.pa-card__header {
  display: flex;
  flex: 0 0 auto;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}
.pa-card__meta {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 8px;
  min-width: 0;
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  line-height: 16px;
}
.pa-card__meta-item {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* 元信息里的「主体」（会话名、工单标题）比标识（短码）更亮一档。 */
.pa-card__meta-strong {
  color: var(--dsw-alias-label-primary);
}
.pa-card__link {
  max-width: 100%;
  padding: 0;
  overflow: hidden;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}
.pa-card__link:hover {
  color: var(--dsw-alias-state-business-primary);
}
.pa-card__header-actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 6px;
}
.pa-card__time {
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  line-height: 16px;
  white-space: nowrap;
}
/* 折叠态题干：跨满整宽（与工单卡正文同结构），两行截断。 */
.pa-card__collapsed-title {
  display: -webkit-box;
  margin: 0;
  overflow: hidden;
  color: var(--dsw-alias-label-primary);
  font-size: 14px;
  font-weight: 400;
  line-height: 22px;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

/* 徽标：一个状态一个徽标，形状统一，色调按语义。 */
.pa-badge {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  height: 16px;
  padding: 0 6px;
  border-radius: var(--dsw-radius-xs);
  background: var(--dsw-alias-bg-overlay);
  color: var(--dsw-alias-label-secondary);
  font-size: 11px;
  font-weight: 500;
  line-height: 16px;
  white-space: nowrap;
}
.pa-badge[data-tone='business'] {
  color: var(--dsw-alias-state-business-primary);
}
.pa-badge[data-tone='success'] {
  color: var(--dsw-alias-state-success-primary);
}
.pa-badge[data-tone='warn'] {
  color: var(--dsw-alias-state-warn-primary);
}
.pa-badge[data-tone='error'] {
  color: var(--dsw-alias-state-error-primary);
}

/* 20px 圆形图标按钮：与 12px 时间同一行时不撑高头部。 */
.pa-icon-button {
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--dsw-alias-label-tertiary);
  cursor: pointer;
}
@media (hover: hover) {
  .pa-icon-button:hover:not(:disabled) {
    background: var(--dsw-alias-interactive-bg-hover);
    color: var(--dsw-alias-label-primary);
  }
}
.pa-icon-button:disabled {
  color: var(--dsw-alias-label-dimmed);
  cursor: default;
}

/* ── 卡片主体 ───────────────────────────────────────────────────────── */
.pa-card__body {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
  margin-top: 8px;
}
/* 正文：与主界面同一套 14/22；工单卡截断到两行。 */
.pa-card__question {
  margin: 0;
  color: var(--dsw-alias-label-primary);
  font-size: 14px;
  font-weight: 400;
  line-height: 22px;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}
.pa-card__question--clamp {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

/* ── 选项 ───────────────────────────────────────────────────────────── */
.pa-card__options {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 8px;
}
.pa-card__option-row {
  position: relative;
  width: 100%;
  border: 0.5px solid transparent;
  border-radius: var(--dsw-radius-sm);
  transition: background-color 120ms ease, border-color 120ms ease;
}
@media (hover: hover) {
  .pa-card__option-row:hover {
    background: var(--dsw-alias-interactive-bg-hover);
  }
}
.pa-card__option-row[data-selected] {
  border-color: var(--dsw-alias-border-l2);
  background: var(--dsw-alias-interactive-bg-hover);
}
.pa-card__option {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  width: 100%;
  min-width: 0;
  padding: 6px 8px;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.pa-card__option:disabled {
  cursor: default;
}
/* 18×18 座位：序号、编辑、附件共用，保证三行文字落在同一条基线上。 */
.pa-card__number,
.pa-card__seat {
  display: grid;
  place-items: center;
  flex: 0 0 18px;
  width: 18px;
  height: 18px;
  margin-top: 1px;
  border-radius: var(--dsw-radius-xs);
  background: var(--dsw-alias-bg-overlay);
  color: var(--dsw-alias-label-secondary);
  font-size: 11px;
  font-weight: 500;
  line-height: 16px;
}
.pa-card__option-copy {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0 6px;
  min-width: 0;
}
.pa-card__option-label {
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
}
.pa-card__option-desc {
  max-width: 100%;
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

/* ── 回答行与附件行：与选项行同高、同内边距、同文字起点 ─────────────── */
.pa-card__answer-row,
.pa-card__attachment-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  width: 100%;
  padding: 6px 8px;
  border: 0.5px solid transparent;
  border-radius: var(--dsw-radius-sm);
}
.pa-card__answer-row {
  margin-top: 8px;
  transition: background-color 120ms ease, border-color 120ms ease;
}
.pa-card__answer-row:focus-within,
.pa-card__answer-row[data-active] {
  border-color: var(--dsw-alias-border-l2);
  background: var(--dsw-alias-interactive-bg-hover);
}
@media (hover: hover) {
  .pa-card__answer-row:hover {
    background: var(--dsw-alias-interactive-bg-hover);
  }
}
.pa-card__answer-row--readonly:hover {
  background: transparent;
}
.pa-card__field {
  display: grid;
  flex: 1;
  min-width: 0;
}
.pa-card__field > * {
  grid-area: 1 / 1;
  min-width: 0;
  padding: 0;
  font: inherit;
  font-size: 13px;
  line-height: 20px;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: anywhere;
}
.pa-card__field-mirror {
  box-sizing: content-box;
  max-height: 120px;
  overflow: hidden;
  visibility: hidden;
}
.pa-card__field-input {
  resize: none;
  overflow-y: auto;
  border: none;
  outline: none;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  caret-color: var(--dsw-alias-state-business-primary);
}
.pa-card__field-input::placeholder {
  color: var(--dsw-alias-label-caption);
}
.pa-card__answer-text {
  flex: 1;
  min-width: 0;
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
  line-height: 20px;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}
.pa-card__attachment-row {
  margin-top: 2px;
}
.pa-card__attachment-copy {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0 6px;
  min-width: 0;
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
  line-height: 20px;
}
.pa-card__attachment-label {
  color: var(--dsw-alias-label-secondary);
}
.pa-card__attachment-file {
  max-width: 100%;
  padding: 0;
  overflow: hidden;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}
.pa-card__attachment-file:hover {
  color: var(--dsw-alias-state-business-primary);
  text-decoration: underline;
}
.pa-card__attachment-hint {
  color: var(--dsw-alias-label-tertiary);
}

/* ── 页脚 ───────────────────────────────────────────────────────────── */
.pa-card__footer {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 8px;
}
.pa-card__pager {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 2px;
}
.pa-card__progress {
  padding: 0 2px;
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  line-height: 16px;
  white-space: nowrap;
}
.pa-card__feedback {
  flex: 1;
  min-height: 16px;
  color: var(--dsw-alias-state-error-primary);
  font-size: 11px;
  line-height: 16px;
  text-align: right;
}
.pa-card__footer-actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 8px;
}

/* ── 按钮：与宿主按钮同一套（28px 高、8px 圆角、13px 字） ───────────── */
.pa-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  box-sizing: border-box;
  height: 28px;
  padding: 0 12px;
  border-radius: var(--dsw-radius-sm);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
  white-space: nowrap;
  cursor: pointer;
}
.pa-button--outline {
  border: 0.5px solid var(--dsw-alias-border-l3);
  background: transparent;
  color: var(--dsw-alias-label-primary);
}
@media (hover: hover) {
  .pa-button--outline:hover:not(:disabled) {
    background: var(--dsw-alias-interactive-bg-hover);
  }
}
.pa-button--primary {
  border: 0.5px solid transparent;
  background: var(--dsw-alias-button-primary-fill);
  color: var(--dsw-alias-label-primary-inverted);
}
@media (hover: hover) {
  .pa-button--primary:hover:not(:disabled) {
    background: var(--dsw-alias-button-primary-hover);
  }
}
.pa-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (prefers-reduced-motion: reduce) {
  .pa-card__option-row,
  .pa-card__answer-row {
    transition: none;
  }
}
`
