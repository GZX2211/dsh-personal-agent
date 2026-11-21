// src/host/runtime/index.ts
//
// 概览运行时读模型的装配面：活动索引与 Worker 注册表各自独立降级，一个坏掉
// 不影响另一个，也不影响快照里的工单/审批/信号。

import type { ActivityStats, WorkerRuntimeView } from '../../shared/runtime.ts'
import type { HostContext } from '../context.ts'
import type { Projection } from '../projector/project.ts'
import type { EventStore } from '../store/event-store.ts'
import { ActivityIndex, emptyActivity } from './activity.ts'
import { WorkerRuntimeRegistry } from './workers.ts'

export interface OverviewRuntime {
  activity(now: number): ActivityStats
  workers(projection: Projection): WorkerRuntimeView[]
  close(): void
}

export interface RuntimeOptions {
  ctx: HostContext
  store: EventStore
  log?: (message: string) => void
}

export function createRuntime(options: RuntimeOptions): OverviewRuntime {
  let activity: ActivityIndex | undefined
  let workers: WorkerRuntimeRegistry | undefined
  try {
    activity = ActivityIndex.open(options.store)
  } catch (error) {
    options.log?.(`overview activity index unavailable: ${describe(error)}`)
  }
  try {
    workers = WorkerRuntimeRegistry.open(options)
  } catch (error) {
    options.log?.(`overview worker runtime unavailable: ${describe(error)}`)
  }
  return {
    activity: now => {
      try {
        return activity?.view(now) ?? emptyActivity(now)
      } catch (error) {
        options.log?.(`overview activity view failed: ${describe(error)}`)
        return emptyActivity(now)
      }
    },
    workers: projection => {
      try {
        return workers?.viewWorkers(projection) ?? []
      } catch (error) {
        options.log?.(`overview worker view failed: ${describe(error)}`)
        return []
      }
    },
    close: () => {
      activity?.close()
      workers?.close()
    },
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
