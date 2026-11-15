// src/client/entry.ts
//
// Client 半区插件入口：声明右侧栏标签页类型、注册正文，并在 P0 阶段自动打开一次
// 面板以完成通道验收（该自动打开在 P1 删除）。

import type { ClientContext } from './context.ts'
import { CONSOLE_ID, CONSOLE_KIND, consoleDefinition } from './definition.ts'
import { ConsoleTabTitle } from './components/ConsoleTabTitle.tsx'
import { detectLanguage, NS, translateFor, type Translate } from './i18n.ts'
import { reportBeacon } from './lib/dev-beacon.ts'
import { ConsolePanel } from './panel/ConsolePanel.tsx'

export const name = 'dsh-personal-agent'

/** 需要的浏览器服务：标签页类型注册表、正文 slot、文案、导航控制器。 */
export const inject = ['slots', 'locale', 'sidebarRightTabs', 'sidebarRight']

/** 自动打开面板的首次延迟与重试间隔（毫秒）：插件挂载时页面上可能还没有被选中的会话。 */
const FIRST_OPEN_DELAY = 1500
const OPEN_RETRY_DELAYS: readonly number[] = [5000, 12000]

export function apply(ctx: ClientContext): void {
  // 语言由 locale 服务给出，文案由本包词典给出：面板不依赖服务端字典注册，
  // 因此某一份字典缺失时只有那一处文案回退，不会让整个面板消失。
  const translate = (): Translate => translateFor(detectLanguage(ctx.locale.getLocale()))

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
            inject: () => ({ t: translate() }),
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

  reportBeacon('plugin-applied', { href: location.href, origin: location.origin })

  ctx.effect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    let attempt = 0
    const open = (): void => {
      attempt += 1
      try {
        ctx.sidebarRight.openTab(CONSOLE_KIND)
        reportBeacon('openTab-ok', { attempt })
      } catch (error) {
        reportBeacon('openTab-error', {
          attempt,
          message: error instanceof Error ? error.message : String(error),
        })
        const nextDelay = OPEN_RETRY_DELAYS[attempt - 1]
        if (nextDelay !== undefined) timer = setTimeout(open, nextDelay)
      }
    }
    timer = setTimeout(open, FIRST_OPEN_DELAY)
    return () => {
      if (timer !== undefined) clearTimeout(timer)
    }
  }, 'personal-agent: p0 auto open')
}
