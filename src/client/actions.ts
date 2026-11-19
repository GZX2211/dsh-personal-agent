// src/client/actions.ts
//
// 总控台的动作面：卡片只管「点了要做什么」，具体服务由 entry 注入，
// 组件不接触网络、会话或右侧栏服务。

export interface ConsoleActions {
  /** 跳到发起这条审批的执行会话。 */
  openSession(sessionId: string): void
  /**
   * 在右侧栏打开一个文件（绝对路径）。
   * @param sessionId - 为该文件读取授权的会话；缺省时退化为无操作。
   */
  openFile(path: string, sessionId: string | undefined): void
  /** 会话的展示名；宿主还没投影出标题时返回 undefined，卡片回退到短码。 */
  sessionTitle(sessionId: string): string | undefined
  /** 切到宿主的自动化任务页；宿主没有该面板时退化为无操作。 */
  openSchedules(): void
}

/** 没有动作面时的占位实现：让组件在测试与降级场景下仍可渲染。 */
export const NO_ACTIONS: ConsoleActions = {
  openSession: () => undefined,
  openFile: () => undefined,
  sessionTitle: () => undefined,
  openSchedules: () => undefined,
}
