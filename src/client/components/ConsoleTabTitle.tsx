// src/client/components/ConsoleTabTitle.tsx
//
// 右侧栏标签条上显示的标题。它单独注册在 `sidebar.right.pane.tab.title`：
// 不注册时宿主要用打开那一刻捕获的文本，语言切换与改名都不会反映到已开的标签。

import type { ReactElement } from 'react'
import type { Translate } from '../i18n.ts'

export interface ConsoleTabTitleProps {
  t: Translate
}

export function ConsoleTabTitle({ t }: ConsoleTabTitleProps): ReactElement {
  return <span>{t('consoleTitle')}</span>
}
