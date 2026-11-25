// src/client/entry.ts
//
// Client 半区插件入口：声明右侧栏标签页类型、注册正文与标签条标题，
// 并把「点会话 / 点文件」这两个跨域动作注入面板。
//
// 只有标签页类型注册表、slot 与 locale 是硬依赖（缺了面板就没有意义）；
// 跳会话与开文件是可选能力，用 ctx.get 取服务、取不到就退化为无操作——
// 两个能力缺失不该让整个面板不加载。

import type { ConsoleActions } from './actions.ts'
import type { ClientContext } from './context.ts'
import { CONSOLE_ID, consoleDefinition } from './definition.ts'
import { ConsoleTabTitle } from './components/ConsoleTabTitle.tsx'
import { detectLanguage, NS, translateFor, type Translate } from './i18n.ts'
import { sessionFileAddress } from './lib/files.ts'
import { sessionTitleOf } from './lib/sessions.ts'
import { ConsolePanel } from './panel/ConsolePanel.tsx'

export const name = 'dsh-gzx-agent'

/** 需要的浏览器服务：标签页类型注册表、正文 slot 与文案。 */
export const inject = ['slots', 'locale', 'sidebarRightTabs']

/** 工作区导航面：只用到 `openSession`。 */
interface WorkspaceNavigation {
  openSession?: (target: string) => void
}

/** 右侧栏导航面：只用到 `openResource`。 */
interface SidebarNavigation {
  openResource?: (address: string) => void
}

/** 会话列表服务：只读 `list.getSnapshot()` 里的展示名。 */
interface SessionListService {
  list?: { getSnapshot?: () => unknown }
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
    openFile: (path, sessionId) => {
      if (sessionId === undefined) return
      const sidebar = ctx.get('sidebarRight') as SidebarNavigation | undefined
      if (sidebar?.openResource === undefined) return
      try {
        // 文档预览按地址里的会话授权读取；当前会话是右侧栏的宿主，也一定活着。
        sidebar.openResource(sessionFileAddress(sessionId, path))
      } catch (error) {
        // 预览插件未挂载时 openResource 会抛错：文件打开是可选能力，不拖垮面板。
        console.error('personal-agent: failed to open file preview', error)
      }
    },
    sessionTitle: sessionId => {
      const sessions = ctx.get('sessions') as SessionListService | undefined
      return sessionTitleOf(sessions?.list?.getSnapshot?.(), sessionId)
    },
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
