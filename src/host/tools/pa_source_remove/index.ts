// src/host/tools/pa_source_remove/index.ts
//
// 删除来源：永久移除定义。历史信号保留在账本里——它们确实发生过，
// 事件页仍要能解释它们的来源名称。

import type { ToolDefinition } from '@deepseek-ai/dsh-tools'
import type { PerceptionService } from '../../perception/service.ts'

export const SOURCE_REMOVE_TOOL_NAME = 'pa_source_remove'

export interface SourceToolDependencies {
  perception: PerceptionService
}

export function createSourceRemoveTool(dependencies: SourceToolDependencies): ToolDefinition {
  return {
    name: SOURCE_REMOVE_TOOL_NAME,
    description: '删除一个感知来源。删除后不再感知，来源页也不再显示它；已经产生的事件记录保留。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['sourceId'],
      properties: {
        sourceId: { type: 'string', description: '来源 id。' },
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['removed'],
        properties: { removed: { type: 'boolean' } },
      },
      render: (_args: unknown, value: unknown) => {
        const result = value as { removed: boolean }
        return [{ type: 'text', text: result.removed ? '来源已删除' : '没有找到这个来源，可能已经被删除了' }]
      },
    },
    execute: async (rawArgs: unknown) => {
      const args = rawArgs as { sourceId?: unknown }
      if (typeof args?.sourceId !== 'string' || args.sourceId.length === 0) {
        throw new Error('sourceId 必须是非空字符串')
      }
      return { removed: await dependencies.perception.remove(args.sourceId) }
    },
  }
}
