// src/host/perception/registry.ts
//
// Channel 工厂注册表。
//
// MVP 的内置 Channel 只有三种；注册表让「有哪些感知方式」成为一个可枚举的集合，
// 来源定义里的 `kind` 与运行体之间的对应关系只有这一份。

import type { L2Event } from '../../shared/events.ts'
import type { ChannelKind } from '../../shared/sources.ts'
import { createFsWatchChannel } from './channels/fs-watch.ts'
import { createHostEventChannel } from './channels/host-event.ts'
import { createScriptChannel } from './channels/script.ts'
import type { ChannelFactory } from './types.ts'

export interface ChannelDependencies {
  /** 订阅账本写入；host-event 用它把事件变成候选。 */
  subscribeLedger?: (listener: (event: L2Event) => void) => () => void
  /** 状态目录：script 渠道的脚本落在这里。 */
  stateDirectory: string
  /** 测试注入：脚本重启退避基数。 */
  restartDelayMs?: number
}

export interface ChannelRegistry {
  factoryFor(kind: ChannelKind): ChannelFactory
}

export function createChannelRegistry(dependencies: ChannelDependencies): ChannelRegistry {
  const factories: Record<ChannelKind, ChannelFactory> = {
    'host-event': context => createHostEventChannel(context, dependencies),
    'fs-watch': context => createFsWatchChannel(context),
    script: context => createScriptChannel(context, dependencies),
  }
  return {
    factoryFor: kind => factories[kind],
  }
}
