// src/shared/runtime.ts
//
// 概览页的运行时读模型契约：Worker 执行状态、上下文占用与最近 7 天活动。
// 这些事实来自 Host 内存与账本聚合，不落账本；它们挂在 SnapshotResponse 上时
// 是可选字段，旧快照与测试夹具仍能渲染，客户端对缺失值做降级。

/** 执行会话的活性；offline 表示工单还开着，但没有活的 Agent。 */
export type WorkerLiveStatus = 'running' | 'idle' | 'offline'

/** 上下文占用：usedTokens 是最近一次请求的提示词 token 数。 */
export interface WorkerContextUsage {
  usedTokens: number
  /** 模型标称窗口；缺省表示路由未报告。 */
  windowTokens?: number
}

/** 一个进行中的执行会话的运行时事实；标题/阶段由客户端与工单 join。 */
export interface WorkerRuntimeView {
  ticketId: string
  workerSessionId: string
  live: WorkerLiveStatus
  /** 最近一次 turn/start 的轮次；还没开始时为 0。 */
  turn: number
  /** 该会话最后一条事件的时间。 */
  lastActivityAt?: number
  /** 还没有模型请求时缺省。 */
  context?: WorkerContextUsage
}

/** 一个本地自然日的信号计数。 */
export interface DayActivity {
  /** 本地自然日 00:00 的时间戳。 */
  start: number
  delivered: number
  filtered: number
}

/** 最近 7 天活动；today 与 days 的最后一项是同一个自然日。 */
export interface ActivityStats {
  today: DayActivity
  days: DayActivity[]
}

/** 执行器容量；来自设置。 */
export interface RuntimeCapacity {
  maxWorkers: number
}
