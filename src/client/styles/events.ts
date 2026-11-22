// src/client/styles/events.ts
//
// 事件域：事件卡片、结局标签与列表状态。
// 类名与数值一律引用 styles/tokens.ts；本文件不定义新的设计变量。

export const EVENTS_CSS = `
/* ── 事件卡片 ───────────────────────────────────────────────────────── */
.pa-signal {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  gap: var(--pa-space-4);
  box-sizing: border-box;
  min-width: 0;
  padding: var(--pa-space-10) var(--pa-space-12);
  border-radius: var(--dsw-radius-md);
  transition: background-color var(--pa-duration-fast) var(--pa-ease-standard);
}
@media (hover: hover) {
  .pa-signal:hover {
    background: var(--dsw-alias-interactive-bg-hover);
  }
}
.pa-signal__head {
  display: flex;
  align-items: center;
  gap: var(--pa-space-8);
  min-width: 0;
}
.pa-signal__kind,
.pa-signal__verdict-tag,
.pa-signal__inferred {
  flex: 0 0 auto;
}
.pa-signal__source {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  color: var(--dsw-alias-label-secondary);
  font-size: var(--pa-font-size-caption);
  line-height: var(--pa-line-height-18);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pa-signal__aside {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: var(--pa-space-6);
  margin-left: auto;
}
.pa-signal__time {
  flex: 0 0 auto;
  color: var(--dsw-alias-label-tertiary);
  font-size: var(--pa-font-size-caption);
  line-height: var(--pa-line-height-18);
  white-space: nowrap;
}
.pa-signal__text {
  display: -webkit-box;
  margin: 0;
  overflow: hidden;
  color: var(--dsw-alias-label-primary);
  font-size: var(--pa-font-size-body);
  line-height: var(--pa-line-height-20);
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  overflow-wrap: anywhere;
}
/*
 * 可点击的结局外套一层官方 Button；这里把按钮的盒子收成零，让尺寸完全由里面的
 * Tag 决定，与只读结局逐像素一致。
 */
.pa-signal__verdict.pa-signal__verdict {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  height: auto;
  min-width: 0;
  min-height: 0;
  padding: 0;
  border: 0;
  background: transparent;
}
.pa-signal__verdict.pa-signal__verdict:hover:not(:disabled) {
  background: transparent;
}
.pa-signal--compact {
  padding: var(--pa-space-6) var(--pa-space-8);
}
.pa-signal--compact .pa-signal__text {
  -webkit-line-clamp: 2;
}
.pa-events__status {
  margin: 0;
  padding: 0 var(--pa-space-16) var(--pa-space-8);
  color: var(--dsw-alias-label-tertiary);
  font-size: var(--pa-font-size-caption);
  line-height: var(--pa-line-height-18);
}
.pa-events__error {
  margin: 0;
  padding: 0 var(--pa-space-16) var(--pa-space-8);
  color: var(--dsw-alias-state-error-primary);
  font-size: var(--pa-font-size-caption);
  line-height: var(--pa-line-height-18);
}

`
