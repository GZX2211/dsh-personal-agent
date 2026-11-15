// src/client/style.ts
//
// 面板样式：只做隔离与布局，颜色/圆角/字号/阴影一律取宿主 design token，
// 不复制设计变量，也不为了贴参考图而自造像素值。
//
// 卡片部分逐条移植官方 `ask_user_question` 提问卡的样式
// （dsh-client-ui-user-questions: QuestionComposer.module.css）：
// 表面、头部、序号座位、选项行、回答框、页脚都保持同一套度量；本插件只
// 新增头部元信息（发起者 / 关联工单 / 时间）与附件行，它们沿用同一批 token。
//
// 构建链路没有 CSS Module 管线（客户端产物是单个 CJS 文件），因此样式集中
// 在本文件；类名用 `pa-` 前缀隔离，避免与宿主样式串味。

export const CONSOLE_CSS = `
/* ── 面板骨架 ───────────────────────────────────────────────────────── */
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
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
}
.pa-console__empty {
  padding: 24px 16px;
  color: var(--dsw-alias-label-tertiary);
  text-align: center;
}
.pa-console__placeholder {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 16px;
  color: var(--dsw-alias-label-secondary);
}
.pa-console__placeholder strong {
  color: var(--dsw-alias-label-primary);
  font-weight: 600;
}

/* ── 过滤条 ─────────────────────────────────────────────────────────── */
.pa-filterbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex: 0 0 auto;
  padding: 8px 16px;
}
.pa-filterbar__capsules {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
}
.pa-filterbar__capsules::-webkit-scrollbar {
  display: none;
}
.pa-capsule {
  height: 28px;
  padding: 0 12px;
  border: 0;
  border-radius: var(--dsw-radius-md);
  background: transparent;
  color: var(--dsw-alias-label-tertiary);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
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
}
.pa-filterbar__tools {
  position: relative;
  display: flex;
  flex: 0 1 auto;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.pa-search {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  gap: 6px;
  box-sizing: border-box;
  height: 32px;
  min-width: 120px;
  max-width: 240px;
  padding: 0 10px;
  border-radius: var(--dsw-radius-md);
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
  width: 248px;
  padding: 12px 14px;
  border-radius: var(--dsw-radius-md);
  background: var(--dsw-alias-bg-layer-2);
  box-shadow: var(--dsw-elevation-prominent);
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  line-height: 18px;
}
.pa-help-pop strong {
  display: block;
  margin-bottom: 6px;
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
  line-height: 18px;
}
.pa-help-pop p {
  margin: 0 0 6px;
}
.pa-help-pop p:last-of-type {
  margin-bottom: 10px;
}
.pa-help-pop__close {
  display: inline-flex;
  align-items: center;
  height: 26px;
  padding: 0 12px;
  border: 0.5px solid var(--dsw-alias-border-l3);
  border-radius: var(--dsw-radius-sm);
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 12px;
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
  border-radius: var(--dsw-radius-md);
  color: var(--dsw-alias-state-error-primary);
  font-size: 12px;
  line-height: 16px;
}
.pa-banner__retry {
  padding: 0 8px;
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

/* ── 卡片外壳（官方 .card / .cardMinimized） ────────────────────────── */
.pa-card {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  width: 100%;
  padding: 0 0 10px;
  border: 0;
  border-radius: var(--dsw-radius-xl);
  background: var(--dsw-specific-input-major);
  box-shadow: var(--dsw-elevation-panel);
  color: var(--dsw-alias-label-primary);
  overflow: hidden;
  --dsw-elevation-stroke-color: var(--dsw-alias-border-l2-darkmode-thin);
  --dsh-scrollbar-thumb: var(--dsw-alias-scrollbar-bg-l2);
  --dsh-scrollbar-thumb-hover: var(--dsw-alias-scrollbar-hover-l2);
}
.pa-card,
.pa-card * {
  box-sizing: border-box;
}
.pa-card[data-collapsed] .pa-card__header {
  padding-bottom: 14px;
}
/* 无交互的行卡片（工单）：没有页脚，靠底部内边距收口。 */
.pa-card--static {
  padding-bottom: 16px;
}

/* ── 卡片头部（官方 .header / .eyebrow + 本插件的时间与折叠） ───────── */
.pa-card__header {
  display: flex;
  flex-shrink: 0;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 16px 0 24px;
}
.pa-card__heading {
  flex: 1;
  min-width: 0;
}
.pa-card__eyebrow {
  display: flex;
  flex-wrap: wrap;
  gap: 0 16px;
  margin-bottom: 5px;
  color: var(--dsw-alias-label-tertiary);
  font-size: 11px;
  line-height: 16px;
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
  flex-shrink: 0;
  align-items: center;
  gap: 4px;
  margin-left: auto;
}
.pa-card__status {
  color: var(--dsw-alias-state-success-primary);
  font-size: 12px;
  line-height: 24px;
  white-space: nowrap;
}
.pa-card__time {
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  line-height: 24px;
  white-space: nowrap;
}
/* 折叠态题干：官方 .cardMinimized .title（16/22、两行截断）。 */
.pa-card__collapsed-title {
  display: -webkit-box;
  margin: 0;
  overflow: hidden;
  color: var(--dsw-alias-label-primary);
  font-size: 16px;
  font-weight: 500;
  line-height: 22px;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

/* 官方 .iconButton：24px 圆形图标按钮。 */
.pa-icon-button {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
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

/* ── 卡片主体（官方 .body） ─────────────────────────────────────────── */
.pa-card__body {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}
/* 官方 .questionTitle + .title：题干与卡片标题同一套 16/22。 */
.pa-card__question {
  flex-shrink: 0;
  margin: 5px 24px 0;
  color: var(--dsw-alias-label-primary);
  font-size: 16px;
  font-weight: 500;
  line-height: 22px;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

/* ── 选项（官方 .options / .optionRow / .option / .number） ──────────── */
.pa-card__options {
  display: flex;
  flex-direction: column;
  gap: 1px;
  margin: 8px 0 0;
  padding: 4px 12px;
}
.pa-card__option-row {
  position: relative;
  width: 100%;
  min-height: 40px;
  flex-shrink: 0;
  border: 0.5px solid transparent;
  border-radius: var(--dsw-radius-md);
  background: transparent;
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
  min-height: 40px;
  padding: 8px 12px 8px 8px;
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
/* 官方 .number：20×20 序号座位，与第一行文字对齐。 */
.pa-card__number {
  display: grid;
  place-items: center;
  flex: 0 0 20px;
  width: 20px;
  height: 20px;
  margin-top: 2px;
  border-radius: var(--dsw-radius-xs);
  background: var(--dsw-alias-bg-overlay);
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
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
  font-size: 14px;
  font-weight: 500;
  line-height: 24px;
}
.pa-card__option-desc {
  max-width: 100%;
  color: var(--dsw-alias-label-tertiary);
  font-size: 13px;
  font-weight: 400;
  line-height: 20px;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

/* ── 回答行与附件行（官方 .customRow / AnswerField） ────────────────── */
.pa-card__answer-row,
.pa-card__attachment-row {
  display: flex;
  flex-shrink: 0;
  align-items: flex-start;
  gap: 8px;
  width: 100%;
  min-height: 40px;
  padding: 8px 12px 8px 8px;
  border: 0.5px solid transparent;
  border-radius: var(--dsw-radius-md);
}
.pa-card__answer-row {
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
/* 编辑图标与附件图标共用序号座位的形状。 */
.pa-card__seat {
  display: grid;
  place-items: center;
  flex: 0 0 20px;
  width: 20px;
  height: 20px;
  margin-top: 2px;
  border-radius: var(--dsw-radius-xs);
  background: var(--dsw-alias-bg-overlay);
  color: var(--dsw-alias-label-secondary);
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
  font-size: 14px;
  line-height: 24px;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: anywhere;
}
.pa-card__field-mirror {
  box-sizing: content-box;
  max-height: 144px;
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
  font-size: 14px;
  line-height: 24px;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}
.pa-card__attachment-copy {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0 6px;
  min-width: 0;
  color: var(--dsw-alias-label-primary);
  font-size: 14px;
  line-height: 24px;
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

/* ── 副标签（工单） ─────────────────────────────────────────────────── */
.pa-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin: 8px 24px 0;
}
.pa-card__tag {
  padding: 0 6px;
  border-radius: var(--dsw-radius-xs);
  background: var(--dsw-alias-bg-overlay);
  color: var(--dsw-alias-label-secondary);
  font-size: 11px;
  font-weight: 500;
  line-height: 18px;
}
.pa-card__tag[data-tag='blocked'] {
  color: var(--dsw-alias-state-warn-primary);
}
.pa-card__tag[data-tag='interrupted'] {
  color: var(--dsw-alias-state-error-primary);
}

/* ── 页脚（官方 .footer / .pager / .progress / .feedback） ──────────── */
.pa-card__footer {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 12px;
  padding: 0 10px 0 18px;
}
.pa-card__pager {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 6px;
}
.pa-card__progress {
  padding: 0 4px;
  color: var(--dsw-alias-label-secondary);
  font-size: 14px;
  font-weight: 500;
  line-height: 24px;
  white-space: nowrap;
  word-spacing: -2px;
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
  flex-shrink: 0;
  align-items: center;
  gap: 12px;
}

/* ── 按钮（宿主按钮的同一套：32px 高、8px 圆角） ────────────────────── */
.pa-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  box-sizing: border-box;
  height: 32px;
  padding: 0 16px;
  border-radius: var(--dsw-radius-sm);
  font: inherit;
  font-size: 14px;
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

/* 窄面板：跟随官方窄屏断点收紧头部与选项的水平留白。 */
@media (max-width: 720px) {
  .pa-card__header {
    padding: 10px 12px 0 18px;
  }
  .pa-card__options {
    padding: 4px 8px;
  }
  .pa-card__question {
    margin-right: 18px;
    margin-left: 18px;
    font-size: 15px;
    line-height: 21px;
  }
  .pa-card__footer {
    align-items: flex-end;
    padding: 0 10px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .pa-card__option-row,
  .pa-card__answer-row {
    transition: none;
  }
}
`
