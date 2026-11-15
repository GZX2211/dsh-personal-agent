// src/client/context.ts
//
// Client 侧的 Cordis 服务声明：逐个 import type 让各包的 `declare module`
// 增强生效（slots / locale / sidebarRight / sidebarRightTabs）。
// 只存在于类型层，编译后不产生运行时依赖。

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'

export type ClientContext = Context
