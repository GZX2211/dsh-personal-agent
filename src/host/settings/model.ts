// src/host/settings/model.ts
//
// 把官方 LLM 目录投影成设置页的只读模型选项。provider 级失败互相隔离：
// 一个服务商的凭据或目录坏了，其他服务商仍可选；单个模型的元数据失败只让它
// 少一个推理强度，不会让整个服务商消失。

import type { HostContext } from '../context.ts'
import type {
  ModelCatalogFailure,
  ModelCatalogView,
  ModelOption,
  ModelProviderOption,
  WorkerModel,
} from '../../shared/settings.ts'

/** 设置页需要的官方模型目录能力；测试用它替身，真实实现从 `ctx.llm` 适配。 */
export interface ModelCatalogSources {
  listProviders(): readonly { id: string; name: string }[]
  listModels(provider: string): Promise<readonly { id: string; name: string }[]>
  resolveReasoning(
    provider: string,
    model: string,
  ): Promise<
    | {
        efforts: readonly { id: string; name: string }[]
        defaultEffort?: string
      }
    | undefined
  >
  /** DSH 当前默认选择；服务缺失时返回 undefined。 */
  defaultSelection(): WorkerModel | undefined
}

/** 没有注入默认选择时返回 null：界面显示「不可用」，不编造一个默认值。 */
function defaultOf(sources: ModelCatalogSources | undefined): WorkerModel | null {
  const selection = sources?.defaultSelection()
  if (selection === undefined) return null
  return selection.provider.length > 0 && selection.model.length > 0 ? { ...selection } : null
}

/**
 * 构建设置页的模型目录视图。
 *
 * `sources` 缺失表示宿主没有 LLM 服务：此时不抛错，而是把一个可展示的失败
 * 放进 `failures`，让界面说明「模型目录不可用」而不是整页报错。
 */
export async function readModelCatalog(
  sources: ModelCatalogSources | undefined,
): Promise<ModelCatalogView> {
  const fallback = defaultOf(sources)
  if (sources === undefined) {
    return {
      default: fallback,
      providers: [],
      failures: [{ id: 'llm', name: 'LLM', message: '模型服务不可用' }],
    }
  }

  const providers: ModelProviderOption[] = []
  const failures: ModelCatalogFailure[] = []
  for (const provider of sources.listProviders()) {
    try {
      const models = await sources.listModels(provider.id)
      const entries = await Promise.all(
        models.map(async model => {
          const reasoning = await sources.resolveReasoning(provider.id, model.id).catch(() => undefined)
          return toOption(model, reasoning)
        }),
      )
      providers.push({ id: provider.id, name: provider.name, models: entries })
    } catch (error) {
      failures.push({ id: provider.id, name: provider.name, message: describe(error) })
    }
  }
  return { default: fallback, providers, failures }
}

function toOption(
  model: { id: string; name: string },
  reasoning: { efforts: readonly { id: string; name: string }[]; defaultEffort?: string } | undefined,
): ModelOption {
  if (reasoning === undefined) return { id: model.id, name: model.name }
  return {
    id: model.id,
    name: model.name,
    reasoning: {
      efforts: reasoning.efforts.map(effort => ({ id: effort.id, name: effort.name })),
      ...(reasoning.defaultEffort === undefined ? {} : { defaultEffort: reasoning.defaultEffort }),
    },
  }
}

/** 官方服务的最小结构面；避免把宿主版本的类型差异带进设置模块。 */
interface LlmRuntimeLike {
  listProviders(): readonly { id: string; name: string }[]
  listModels(provider: string): Promise<readonly { id: string; name: string }[]>
  resolveModelInfo(
    provider: string,
    model: string,
  ): Promise<{
    reasoning?: {
      efforts: readonly { id: string; name: string }[]
      defaultEffort?: string
    }
  }>
}

interface AgentDefaultModelLike {
  currentSelection(): { provider: string; model: string; reasoningEffort?: string }
}

/**
 * 从宿主上下文适配模型目录；两个服务都按可选处理。
 *
 * `ctx.get` 返回的是宿主注入的服务实例，本插件不反向依赖这些包的具体版本。
 */
export function hostModelCatalog(ctx: HostContext): Promise<ModelCatalogView> {
  const llm = ctx.get('llm') as LlmRuntimeLike | undefined
  const defaults = ctx.get('agentDefaultModel') as AgentDefaultModelLike | undefined
  const sources: ModelCatalogSources | undefined =
    llm === undefined
      ? undefined
      : {
          listProviders: () => llm.listProviders(),
          listModels: provider => llm.listModels(provider),
          resolveReasoning: async (provider, model) => {
            const info = await llm.resolveModelInfo(provider, model)
            return info.reasoning === undefined
              ? undefined
              : {
                  efforts: info.reasoning.efforts.map(effort => ({ id: effort.id, name: effort.name })),
                  ...(info.reasoning.defaultEffort === undefined
                    ? {}
                    : { defaultEffort: info.reasoning.defaultEffort }),
                }
          },
          defaultSelection: () => {
            if (defaults === undefined) return undefined
            const selection = defaults.currentSelection()
            return {
              provider: selection.provider,
              model: selection.model,
              ...(selection.reasoningEffort === undefined
                ? {}
                : { reasoningEffort: selection.reasoningEffort }),
            }
          },
        }
  return readModelCatalog(sources)
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
