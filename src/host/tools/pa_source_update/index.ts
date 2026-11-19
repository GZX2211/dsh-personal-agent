// src/host/tools/pa_source_update/index.ts
//
// 改来源工具：只改给出的字段。传了 channel 或 threads 就是整体替换——半截替换
// 会让旧线程的计数与日志失去解释，模型要改线程就给出完整列表。

import type { ToolDefinition } from '@deepseek-ai/dsh-tools'
import type { PerceptionService } from '../../perception/service.ts'

export const SOURCE_UPDATE_TOOL_NAME = 'pa_source_update'

export interface SourceToolDependencies {
  perception: PerceptionService
}

export function createSourceUpdateTool(dependencies: SourceToolDependencies): ToolDefinition {
  return {
    name: SOURCE_UPDATE_TOOL_NAME,
    description:
      '修改一个已存在的感知来源。只改给出的字段；传了 channel 或 threads 就是整体替换（请给出完整定义）。要临时停掉来源用 enabled=false，要恢复用 enabled=true。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['sourceId'],
      properties: {
        sourceId: { type: 'string', description: '要修改的来源 id。' },
        name: { type: 'string', maxLength: 60, description: '新的来源名称。' },
        description: { type: 'string', description: '新的一句话说明。' },
        enabled: { type: 'boolean', description: '是否启用；false 会停掉正在运行的渠道。' },
        channel: {
          type: 'object',
          description: '整体替换的渠道定义；形状与 pa_source_create 里的 channel 相同。',
        },
        threads: {
          type: 'array',
          items: { type: 'object' },
          description: '整体替换的线程列表；形状与 pa_source_create 里的 threads 相同。',
        },
        script: { type: 'string', description: '替换 script 渠道的脚本正文。' },
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['sourceId', 'name', 'status'],
        properties: {
          sourceId: { type: 'string' },
          name: { type: 'string' },
          status: { type: 'string', enum: ['running', 'stopped', 'error'] },
          lastError: { type: 'string' },
        },
      },
      render: (_args: unknown, value: unknown) => {
        const result = value as { name: string; status: string; lastError?: string }
        if (result.status === 'error') {
          return [{ type: 'text', text: `来源「${result.name}」已更新，但启动失败：${result.lastError ?? '未知原因'}` }]
        }
        return [{ type: 'text', text: `来源「${result.name}」已更新（${result.status === 'running' ? '运行中' : '已停止'}）` }]
      },
    },
    execute: async (rawArgs: unknown) => {
      const view = await dependencies.perception.update(rawArgs)
      return {
        sourceId: view.id,
        name: view.name,
        status: view.status,
        ...(view.lastError === undefined ? {} : { lastError: view.lastError }),
      }
    },
  }
}
