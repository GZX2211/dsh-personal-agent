// src/host/sessions/model.ts
//
// 执行器模型的播种：设置页选了模型时，新 worker 在第一个请求前写入选中的
// route，并让首个请求使用它；请求一旦落头，会话自己的选择生效，设置不再覆盖。
//
// 刻意不走 `sessionController.selectModel`：它会顺手改写全局 DSH 默认模型，
// 而这里要表达的只是「这一单用什么」。

import type { Agent } from '@deepseek-ai/dsh-agent'
import { ReasoningEffortId } from '@deepseek-ai/dsh-llm'
import type { WorkerModel } from '../../shared/settings.ts'
import type { HostContext } from '../context.ts'

export interface SeedWorkerModelOptions {
  /** 把设置页的选择解析成当前目录可用的 route；缺省走宿主 LLM 服务。 */
  resolve?: (model: WorkerModel) => Promise<WorkerModel>
}

interface LlmLike {
  resolveCallConfig(config: {
    provider: string
    model: string
    reasoningEffort?: string
  }): Promise<{ provider: string; model: string; reasoningEffort?: string }>
}

function toSelection(model: WorkerModel) {
  return {
    provider: model.provider,
    model: model.model,
    ...(model.reasoningEffort === undefined
      ? {}
      : { reasoningEffort: ReasoningEffortId(model.reasoningEffort) }),
  }
}

/** 会话已经记过选择或发过请求时不再播种：用户/目录的选择优先于设置页。 */
function hasRecordedSelection(agent: Agent): boolean {
  if (agent.session.requestHeader() !== undefined) return true
  return agent.session
    .snapshotEvents()
    .some(event => event.type === 'model/selection' || event.type === 'request/header')
}

async function resolveThroughHost(ctx: HostContext, model: WorkerModel): Promise<WorkerModel> {
  const llm = ctx.get('llm') as LlmLike | undefined
  if (llm === undefined) throw new Error('LLM 服务不可用，无法解析执行器模型')
  const value = await llm.resolveCallConfig({
    provider: model.provider,
    model: model.model,
    ...(model.reasoningEffort === undefined ? {} : { reasoningEffort: model.reasoningEffort }),
  })
  return {
    provider: value.provider,
    model: value.model,
    ...(value.reasoningEffort === undefined ? {} : { reasoningEffort: value.reasoningEffort }),
  }
}

/**
 * 给新 worker 播种模型；返回是否真的写入了选择。
 *
 * 写入顺序是先 append `model/selection`、再挂首个请求的覆盖钩子：这样钩子不会
 * 把自己刚写的事件当成「已经发过请求」而失效。
 */
export async function seedWorkerModel(
  ctx: HostContext,
  agent: Agent,
  model: WorkerModel | null,
  options: SeedWorkerModelOptions = {},
): Promise<boolean> {
  if (model === null) return false
  if (hasRecordedSelection(agent)) return false

  const resolve = options.resolve ?? (input => resolveThroughHost(ctx, input))
  const selection = await resolve(model)
  agent.session.append('model/selection', toSelection(selection))
  installInitialRequestOverride(ctx, agent, selection)
  return true
}

/**
 * 只覆盖第一个请求：`agent/request` 返回的配置里剥掉继承的推理强度再套上选择，
 * 避免「provider/model 是设置的、effort 却是宿主默认」的混搭。
 */
function installInitialRequestOverride(ctx: HostContext, agent: Agent, selection: WorkerModel): void {
  let initial = true
  agent.ctx.effect(() => {
    const disposers: (() => void)[] = [
      agent.ctx.on(
        'agent/request',
        async (_payload, next) => {
          const result = await next()
          if (!initial) return result
          const { reasoningEffort: _inherited, ...rest } = result
          return { ...rest, ...toSelection(selection) }
        },
        { prepend: true },
      ),
      ctx.on('session/event', (session, event) => {
        if (
          session === agent.session &&
          (event.type === 'request/header' || event.type === 'model/selection')
        ) {
          initial = false
        }
      }),
    ]
    return () => {
      for (const dispose of disposers.reverse()) dispose()
    }
  }, 'personal-agent: worker model seed')
}
