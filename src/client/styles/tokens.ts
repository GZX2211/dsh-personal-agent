// src/client/styles/tokens.ts
//
// 全站唯一的设计变量来源。分三段：
//   ① 平台引用：宿主主题已经给出变量，插件只起名，不复制值；
//   ② 插件刻度：宿主没有的维度（间距、行高、控件高度、层级、领域色板）；
//   ③ 过渡值：宿主有对应刻度但当前实现取值不同，先锁定现状，收敛目标写在注释里。
//
// 除本文件外，任何样式文件都不得写这些维度的具体值。
//
// 字体规则：
//   · 字号 13 档是过渡状态，最终目标是收敛到官方刻度 14/13/12/11 + 两个微型档；
//   · 行高按数值命名，只允许与对应字号档配对使用（配对表见 docs 规划）；
//   · Tab 条是官方对齐区，单独一组 token，禁止随排版刻度调整。

export const TOKENS_CSS = `
:root {
  /* 组件注入的局部变量契约：由 TSX 内联赋值或 kind 类覆盖，样式只消费。 */
  --pa-kind: var(--pa-kind-default);
  --pa-rail-w: 10px;

  /* ── ① 平台引用 ─────────────────────────────────────────────────── */
  --pa-font-family: var(--dsw-font-family);
  --pa-font-family-mono: var(--ds-font-family-code, 'SF Mono', 'JetBrains Mono', 'Fira Code', Consolas, 'Liberation Mono', Menlo, Courier, monospace);

  --pa-radius-xs: var(--dsw-radius-xs);
  --pa-radius-sm: var(--dsw-radius-sm);
  --pa-radius-md: var(--dsw-radius-md);
  --pa-radius-lg: var(--dsw-radius-lg);

  --pa-focus-ring: var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));

  /* 工单交接类型色板：官方没有业务分类色，这里独占；语义与官方 state 色对齐。 */
  --pa-kind-default: var(--dsw-alias-label-tertiary);
  --pa-kind-dispatch: #8b7bff;
  --pa-kind-supplement: #4fb8d9;
  --pa-kind-spawn: #a98bff;
  --pa-kind-up: #3fb9a1;
  --pa-kind-sync: #8a93a6;
  --pa-kind-approval: #e0a24a;
  --pa-kind-decision: #4fc38a;
  --pa-kind-intervene: #b9c1d1;
  --pa-kind-state: #8a8a92;
  --pa-kind-fail: #ff6b6b;
  --pa-kind-fail-label: #ff9b9b;

  /* ── ② 插件刻度：字号（过渡值，目标见文件头） ───────────────────── */
  --pa-font-size-display: 18px;
  --pa-font-size-title-lg: 15.5px;
  --pa-font-size-glyph: 15px;
  --pa-font-size-title: 14px;
  --pa-font-size-body: 13px;
  --pa-font-size-subtitle: 12.5px;
  --pa-font-size-caption: 12px;
  --pa-font-size-note: 11.5px;
  --pa-font-size-label: 11px;
  --pa-font-size-meta: 10.5px;
  --pa-font-size-xs: 10px;
  --pa-font-size-2xs: 9.5px;
  --pa-font-size-nano: 9px;

  /* 行高：数值即刻度，只能与字号档配对使用。 */
  --pa-line-height-none: 1;
  --pa-line-height-11: 11px;
  --pa-line-height-13: 13px;
  --pa-line-height-14: 14px;
  --pa-line-height-15: 15px;
  --pa-line-height-16: 16px;
  --pa-line-height-17: 17px;
  --pa-line-height-18: 18px;
  --pa-line-height-20: 20px;
  --pa-line-height-22: 22px;
  --pa-line-height-24: 24px;

  --pa-font-weight-regular: 400;
  --pa-font-weight-medium: 500;
  --pa-font-weight-semibold: 600;

  --pa-letter-spacing-tight: 0.01em;
  --pa-letter-spacing-wide: 0.02em;
  --pa-letter-spacing-caps: 0.04em;

  /* ── ② 插件刻度：间距（过渡值，目标收敛到 2/4/6/8/10/12/16/24） ── */
  --pa-space-1: 1px;
  --pa-space-2: 2px;
  --pa-space-3: 3px;
  --pa-space-4: 4px;
  --pa-space-5: 5px;
  --pa-space-6: 6px;
  --pa-space-7: 7px;
  --pa-space-8: 8px;
  --pa-space-9: 9px;
  --pa-space-10: 10px;
  --pa-space-11: 11px;
  --pa-space-12: 12px;
  --pa-space-14: 14px;
  --pa-space-16: 16px;
  --pa-space-18: 18px;
  --pa-space-22: 22px;
  --pa-space-24: 24px;

  /* ── ② 插件刻度：圆角（官方刻度之外的现状值） ───────────────────── */
  --pa-radius-1: 1px;
  --pa-radius-2: 2px;
  --pa-radius-3: 3px;
  --pa-radius-6: 6px;
  --pa-radius-pill: 999px;
  --pa-radius-circle: 50%;

  /* ── ② 插件刻度：控件高度（现状六档，按钮 22 档待收敛） ──────────── */
  --pa-control-height-2xs: 20px;
  --pa-control-height-xs: 22px;
  --pa-control-height-sm: 28px;
  --pa-control-height-md: 30px;
  --pa-control-height-lg: 32px;
  --pa-control-height-xl: 36px;

  /* ── ② 插件刻度：图标与圆点 ────────────────────────────────────── */
  --pa-icon-size-sm: 14px;
  --pa-icon-size-md: 16px;
  --pa-dot-size-xs: 4px;
  --pa-dot-size-sm: 5px;
  --pa-dot-size-md: 6px;
  --pa-dot-size-lg: 8px;
  --pa-seat-width: 12px;
  --pa-seat-height: 4px;
  --pa-legend-line-width: 10px;
  --pa-legend-line-height: 1.5px;

  /* ── ② 插件刻度：边框、动效、层级、阴影 ───────────────────────── */
  --pa-hairline: 0.5px;
  --pa-border-width-thin: 1px;
  --pa-border-width-1-5: 1.5px;
  --pa-border-width-emphasis: 2px;
  --pa-duration-fast: 120ms;
  --pa-duration-rotate: 420ms;
  --pa-duration-pulse: 2s;
  --pa-ease-standard: ease;
  --pa-ease-out: ease-out;
  --pa-z-savebar: 2;
  --pa-z-lane-header: 6;
  --pa-shadow-float: 0 2px 8px rgba(0, 0, 0, 0.28);

  /* ── ③ Tab 条官方对齐区：禁止随排版刻度调整 ─────────────────────── */
  --pa-tabs-height: 38px;
  --pa-tabs-padding-x: 16px;
  --pa-tabs-gap: 24px;
  --pa-tabs-font-size: 13px;
  --pa-tabs-line-height: 20px;
  --pa-tabs-font-weight: 500;
  --pa-tabs-underline-height: 2px;
}
`
