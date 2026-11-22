// src/client/styles/sources.ts
//
// 来源域：来源卡片、配置、测试结果与线程行。
// 类名与数值一律引用 styles/tokens.ts；本文件不定义新的设计变量。

export const SOURCES_CSS = `
/* ── 来源卡片与线程行 ───────────────────────────────────────────────── */
.pa-source__dot,
.pa-source__channel,
.pa-source__switch,
.pa-source__status {
  flex: 0 0 auto;
}
.pa-source__status {
  color: var(--dsw-alias-label-secondary);
  font-size: var(--pa-font-size-caption);
  line-height: var(--pa-line-height-18);
  white-space: nowrap;
}
.pa-source__threads-summary {
  flex: 0 0 auto;
  color: var(--dsw-alias-label-tertiary);
  font-size: var(--pa-font-size-caption);
  line-height: var(--pa-line-height-18);
  white-space: nowrap;
}
.pa-source__threads {
  display: flex;
  flex-direction: column;
  gap: var(--pa-space-2);
}
.pa-thread {
  display: flex;
  align-items: center;
  gap: var(--pa-space-8);
  min-width: 0;
  padding: var(--pa-space-4) var(--pa-space-6);
  border-radius: var(--dsw-radius-sm);
}
@media (hover: hover) {
  .pa-thread:hover {
    background: var(--dsw-alias-interactive-bg-hover);
  }
}
.pa-thread__main {
  display: flex;
  flex: 1 1 auto;
  align-items: baseline;
  gap: var(--pa-space-8);
  min-width: 0;
}
.pa-thread__name {
  overflow: hidden;
  color: var(--dsw-alias-label-primary);
  font-size: var(--pa-font-size-body);
  font-weight: var(--pa-font-weight-medium);
  line-height: var(--pa-line-height-20);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pa-thread__counts {
  color: var(--dsw-alias-label-tertiary);
  font-size: var(--pa-font-size-caption);
  line-height: var(--pa-line-height-18);
  white-space: nowrap;
}
.pa-thread__time {
  margin-left: auto;
  color: var(--dsw-alias-label-tertiary);
  font-size: var(--pa-font-size-caption);
  line-height: var(--pa-line-height-18);
  white-space: nowrap;
}
.pa-thread__switch {
  flex: 0 0 auto;
}
.pa-source__config {
  display: flex;
  gap: var(--pa-space-6);
  min-width: 0;
  margin: var(--pa-space-8) 0 0;
  color: var(--dsw-alias-label-secondary);
  font-size: var(--pa-font-size-caption);
  line-height: var(--pa-line-height-18);
}
.pa-source__config-label {
  flex: 0 0 auto;
  color: var(--dsw-alias-label-tertiary);
}
.pa-source__config-value {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pa-source__error {
  margin: var(--pa-space-8) 0 0;
  color: var(--dsw-alias-state-error-primary);
  font-size: var(--pa-font-size-caption);
  line-height: var(--pa-line-height-18);
  overflow-wrap: anywhere;
}
.pa-source__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--pa-space-8);
  margin-top: var(--pa-space-8);
}
.pa-source__test {
  margin-top: var(--pa-space-8);
  padding-top: var(--pa-space-8);
  border-top: var(--pa-hairline) solid var(--dsw-alias-border-l1);
}
.pa-source__test-title {
  margin: 0 0 var(--pa-space-4);
  color: var(--dsw-alias-label-tertiary);
  font-size: var(--pa-font-size-caption);
  line-height: var(--pa-line-height-18);
}
.pa-source__test-empty {
  margin: 0;
  color: var(--dsw-alias-label-tertiary);
  font-size: var(--pa-font-size-caption);
  line-height: var(--pa-line-height-18);
}
.pa-source__test-list {
  display: flex;
  flex-direction: column;
  gap: var(--pa-space-2);
}

`
