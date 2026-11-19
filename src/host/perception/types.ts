// src/host/perception/types.ts
//
// 感知运行时的内部类型：Channel 产出候选事实，运行时负责过滤与投递。
// 这些类型只活在进程内，不进入账本，也不跨 Host / Client 边界。

import type { ChannelDefinition, ThreadDefinition } from '../../shared/sources.ts'

/** 一条候选事实：Channel 产出、尚未经过滤。 */
export interface Candidate {
  /** 归属线程 id；必须是该来源线程表里的一条。 */
  thread: string
  /** 事实陈述（模板已渲染）。 */
  statement: string
  /** 来源侧去重键；缺省时由运行时用 statement 派生。 */
  externalId?: string
  /** 候选自身的时间（毫秒）；缺省用到达时间。 */
  at?: number
  /** edge 模式的比较状态；缺失时该线程退化为 level。 */
  state?: string
  /** Channel 提供的额外事实（如文件事件的 path），供 match 表达式取值。 */
  facts?: Record<string, unknown>
}

/** Channel 启动时拿到的一切：它自己的配置，以及把事实交出去的通道。 */
export interface ChannelContext {
  sourceId: string
  channel: ChannelDefinition
  threads: readonly ThreadDefinition[]
  /** 产出一条候选；过滤与投递由运行时负责。 */
  emit(candidate: Candidate): void
  /** 非致命问题：照常运行，但要能解释为什么什么都没感知到。 */
  warn(message: string): void
}

/** 一个 Channel 的运行体；`start` 失败应抛错，由服务把来源标记为 error。 */
export interface ChannelRuntime {
  start(): () => void
  /**
   * 可选：注入一条合成候选，供来源页的「测试」用。
   *
   * 只产生候选，不改变渠道的长期状态；候选照常走过滤与投递，因此测试看到的
   * 就是真实链路的结果。
   */
  probe?(): void
}

export type ChannelFactory = (context: ChannelContext) => ChannelRuntime
