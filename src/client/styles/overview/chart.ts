// src/client/styles/overview/chart.ts
//
// 概览域：7 日柱状图与图例。
// 类名与数值一律引用 styles/tokens.ts；本文件不定义新的设计变量。

export const OVERVIEW_CHART_CSS = `
.pa-overview__chart {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  gap: var(--pa-space-8);
}
.pa-overview__chart-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--pa-space-8);
}
.pa-overview__legend {
  display: inline-flex;
  align-items: center;
  gap: var(--pa-space-4);
  color: var(--dsw-alias-label-tertiary);
  font-size: var(--pa-font-size-label);
  line-height: var(--pa-line-height-16);
}
.pa-overview__legend-dot {
  display: inline-block;
  width: var(--pa-dot-size-md);
  height: var(--pa-dot-size-md);
  margin-left: var(--pa-space-4);
  border-radius: var(--pa-radius-circle);
  background: var(--dsw-alias-state-business-primary);
}
.pa-overview__legend-dot:first-child {
  margin-left: 0;
}
.pa-overview__legend-dot[data-kind='filtered'] {
  background: var(--dsw-alias-state-warn-primary);
}
.pa-overview__bars {
  display: flex;
  align-items: flex-end;
  gap: var(--pa-space-7);
  height: 54px;
  padding: 0 var(--pa-space-2);
}
.pa-overview__bar-col {
  display: flex;
  flex: 1 1 0;
  flex-direction: column;
  justify-content: flex-end;
  gap: var(--pa-space-1);
  height: 100%;
  min-width: 0;
}
.pa-overview__bar {
  display: block;
  width: 100%;
  border-radius: var(--pa-radius-2) var(--pa-radius-2) var(--pa-radius-1) var(--pa-radius-1);
  background: var(--dsw-alias-state-business-primary);
}
.pa-overview__bar[data-kind='filtered'] {
  background: var(--dsw-alias-state-warn-primary);
}
.pa-overview__bar[data-kind='empty'] {
  border-radius: var(--pa-radius-1);
  background: var(--dsw-alias-border-l2);
}
.pa-overview__days {
  display: flex;
  gap: var(--pa-space-7);
  padding: 0 var(--pa-space-2);
}
.pa-overview__day {
  flex: 1 1 0;
  overflow: hidden;
  min-width: 0;
  color: var(--dsw-alias-label-tertiary);
  font-size: var(--pa-font-size-micro);
  line-height: var(--pa-line-height-14);
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pa-overview__day[data-today='true'] {
  color: var(--dsw-alias-label-primary);
  font-weight: var(--pa-font-weight-medium);
}
`
