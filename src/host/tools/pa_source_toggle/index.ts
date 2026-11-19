// src/host/tools/pa_source_toggle/index.ts
//
// 开关来源：一条语义化操作，不要求模型自己拼 update 的全量定义。

import type { ToolDefinition } from '@deepseek-ai/dsh-tools'
import type { PerceptionService } from '../../perception/service.ts'

export const SOURCE_TOGGLE_TOOL_NAME = 'pa_source_toggle'

export interface SourceToolDependencies {
  perception: PerceptionService
}

export function createSourceToggleTool(dependencies: SourceToolDependencies): ToolDefinition {
  return {
    name: SOURCE_TOGGLE_TOOL_NAME,
    description: '打开或关闭一个感知来源。关闭后该来源不再产生任何事件，也不留任何记录。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['sourceId', 'enabled'],
      properties: {
        sourceId: { type: 'string', description: '来源 id。' },
        enabled: { type: 'boolean', description: 'true 打开，false 关闭。' },
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['sourceId', 'enabled', 'status'],
        properties: {
          sourceId: { type: 'string' },
          enabled: { type: 'boolean' },
          status: { type: 'string', enum: ['running', 'stopped', 'error'] },
          lastError: { type: 'string' },
        },
      },
      render: (_args: unknown, value: unknown) => {
        const result = value as { enabled: boolean; status: string; lastError?: string }
        if (result.status === 'error') {
          return [{ type: 'text', text: `来源已打开，但启动失败：${result.lastError ?? '未知原因'}` }]
        }
        return [{ type: 'text', text: result.enabled ? '来源已打开，开始感知' : '来源已关闭，不再感知' }]
      },
    },
    execute: async (rawArgs: unknown) => {
      const args = rawArgs as { sourceId?: unknown; enabled?: unknown }
      if (typeof args?.sourceId !== 'string' || args.sourceId.length === 0) {
        throw new Error('sourceId 必须是非空字符串')
      }
      if (typeof args.enabled !== 'boolean') throw new Error('enabled 必须是布尔值')

      const view = await dependencies.perception.toggle(args.sourceId, args.enabled)
      return {
        sourceId: view.id,
        enabled: view.enabled,
        status: view.status,
        ...(view.lastError === undefined ? {} : { lastError: view.lastError }),
      }
    },
  }
}
