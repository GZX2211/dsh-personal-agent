// src/client/definition.ts
//
// 右侧栏标签页的类型声明（stage one）：只有静态事实，没有运行时钩子。
// 面板正文在 entry.ts 里按同一个 id 注册到 `sidebar.right.pane.tab`。

import type { SidebarRightTabDefinition } from '@deepseek-ai/dsh-client-ui-sidebar-right/client'

/** 实现身份：跨所有注册唯一，同时是正文与标题所在 slot 的 key。 */
export const CONSOLE_ID = 'dsh-personal-agent/console'

/** 类型判别值：`openTab` 用这个名字打开页面。 */
const CONSOLE_KIND = 'personal-agent-console'

/** 指南页上的入口 id（同一 provider 内唯一）。 */
const GUIDE_ENTRY_ID = 'console'

export interface ConsoleCopy {
  title: string
  description: string
}

/**
 * 文案取 getter 而不是值：标签条与指南卡片每次使用都重读，语言切换无需重新注册。
 */
export function consoleDefinition(copy: () => ConsoleCopy): SidebarRightTabDefinition {
  return {
    id: CONSOLE_ID,
    kind: CONSOLE_KIND,
    title: () => copy().title,
    guide: [
      {
        id: GUIDE_ENTRY_ID,
        order: 10,
        title: () => copy().title,
        description: () => copy().description,
      },
    ],
  }
}
