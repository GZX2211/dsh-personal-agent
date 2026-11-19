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
import type {} from '@deepseek-ai/dsh-system-prompt'
import type {} from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-workspace'
import type {} from '@deepseek-ai/dsh-working-directory'
import type { ScheduleService } from './perception/timers.ts'
import type {} from './roles/index.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /**
     * 官方调度服务。
     *
     * 本插件只读它的任务目录（来源页的定时分区），不为它声明硬依赖：宿主没挂载时
     * `ctx.get('schedule')` 返回 undefined，定时分区降级为空。官方类型包与本插件
     * 的宿主版本不同源，因此这里只声明用到的那个读方法。
     */
    schedule?: ScheduleService
  }
}

export type HostContext = Context
