// src/client/entry.ts
//
// Client 半区插件入口：声明右侧栏标签页类型、注册正文与标签条标题，
// 并把「点会话 / 点文件」这两个跨域动作注入面板。

import type { ConsoleActions } from './actions.ts'
import type { ClientContext } from './context.ts'
import { CONSOLE_ID, consoleDefinition } from './definition.ts'
import { ConsoleTabTitle } from './components/ConsoleTabTitle.tsx'
import { detectLanguage, NS, translateFor, type Translate } from './i18n.ts'
import { absoluteFileAddress } from './lib/files.ts'
import { sessionTitleOf } from './lib/sessions.ts'
import { ConsolePanel } from './panel/ConsolePanel.tsx'

export const name = 'dsh-personal-agent'

/** 需要的浏览器服务：标签页类型注册表、正文 slot、文案、会话与右侧栏。 */
export const inject = ['slots', 'locale', 'sidebarRightTabs', 'sidebarRight', 'sessions']

/** 只用到 `openSession` 一个方法；服务未挂载时按「点了没反应」降级。 */
interface WorkspaceNavigation {
  openSession?: (target: string) => void
}

export function apply(ctx: ClientContext): void {
  // 语言由 locale 服务给出，文案由本包词典给出：面板不依赖服务端字典注册，
  // 因此某一份字典缺失时只有那一处文案回退，不会让整个面板消失。
  const translate = (): Translate => translateFor(detectLanguage(ctx.locale.getLocale()))

  const actions: ConsoleActions = {
    openSession: sessionId => {
      const workspace = ctx.get('uiWorkspace') as WorkspaceNavigation | undefined
      workspace?.openSession?.(sessionId)
    },
    openFile: path => ctx.sidebarRight.openResource(absoluteFileAddress(path)),
    // 面板自己的标签状态由 ConsolePanel 覆盖。
    showTickets: () => undefined,    sessionTitle: sessionId => sessionTitleOf(ctx.sessions.list.getSnapshot(), sessionId),
  }

  ctx.effect(
    () =>
      ctx.sidebarRightTabs.register(
        consoleDefinition(() => ({
          title: translate()('consoleTitle'),
          description: translate()('consoleDescription'),
        })),
      ),
    'personal-agent: console tab type',
  )

  ctx.effect(
    () =>
      ctx.slots.inject('sidebar.right.pane.tab', () =>
        ctx.slots.register(
          {
            name: 'sidebar.right.pane.tab',
            key: CONSOLE_ID,
            locale: NS,
            inject: () => ({
              t: translate(),
              language: detectLanguage(ctx.locale.getLocale()),
              actions,
            }),
          },
          ConsolePanel,
        ),
      ),
    'personal-agent: console body',
  )

  // 标签条上的标题单独注册：不注册时宿主沿用打开时捕获的文本，改名不会反映到已开标签。
  ctx.effect(
    () =>
      ctx.slots.inject('sidebar.right.pane.tab.title', () =>
        ctx.slots.register(
          { name: 'sidebar.right.pane.tab.title', key: CONSOLE_ID, locale: NS, inject: () => ({ t: translate() }) },
          ConsoleTabTitle,
        ),
      ),
    'personal-agent: console tab title',
  )
}
