// src/host/context.ts
//
// Host 侧用到的 Cordis 服务声明：逐个 import type 让各包的 `declare module`
// 增强生效，这样 `ctx.sessionController` 之类无需在调用点手写结构类型。
// 这些 import 只存在于类型层，编译后不产生运行时依赖。

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-api-session-controller'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-session-persistence'
import type {} from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-workspace'
import type {} from '@deepseek-ai/dsh-working-directory'

export type HostContext = Context
