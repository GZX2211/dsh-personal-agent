// src/host/tools/pa_source_create/index.ts
//
// router 的建来源工具：把一个「持续关注某处」的请求变成可运行的感知来源。
// 参数校验在来源服务里做（一次报全所有问题），这里只负责把结果翻译给模型。

import type { ToolDefinition } from '@deepseek-ai/dsh-tools'
import type { PerceptionService } from '../../perception/service.ts'

export const SOURCE_CREATE_TOOL_NAME = 'pa_source_create'

export interface SourceToolDependencies {
  perception: PerceptionService
}

const CHANNEL_SCHEMA_DESCRIPTION = [
  '感知方式，按 kind 三选一：',
  'host-event：{ kind: "host-event", subscriptions: [{ event, thread, statement }] }，订阅内部状态变化；',
  'fs-watch：{ kind: "fs-watch", paths: string[], recursive?, events?, ignore?, debounceMs?, statement? }，盯本地文件；',
  'script：{ kind: "script", command, args?, cwd?, env?, restart? }，跑常驻脚本感知外部服务（脚本正文放在 script 参数里）。',
].join('\n')

const THREADS_SCHEMA_DESCRIPTION = [
  '线程定义数组，每条：{ id, name, enabled, match?, dedupe?, minGapSec?, mode?, interrupt? }。',
  '线程是分类与过滤的粒度：match 用 { path, op, value } 做确定性筛选，op 取 eq / neq / contains / startsWith / endsWith / regex / in / gt / lt，可用 all / any / not 组合。',
].join('\n')

export function createSourceCreateTool(dependencies: SourceToolDependencies): ToolDefinition {
  return {
    name: SOURCE_CREATE_TOOL_NAME,
    description:
      '创建一个感知来源：来源会持续把外部发生的事实以「感知事件」的形式投递给 router，不消耗模型调用。用户说「盯着 / 监控 / 有变化就告诉我」时使用。创建前请确认渠道、线程与陈述的写法（见 perception-source skill）。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['name', 'channel', 'threads'],
      properties: {
        name: {
          type: 'string',
          maxLength: 60,
          description: '来源名称，展示给用户，例如「本地文件 · watchme」。',
        },
        description: { type: 'string', description: '一句话说明这个来源在盯什么。' },
        enabled: { type: 'boolean', description: '创建后是否立即启动；缺省 true。' },
        channel: { type: 'object', description: CHANNEL_SCHEMA_DESCRIPTION },
        threads: {
          type: 'array',
          items: { type: 'object' },
          description: THREADS_SCHEMA_DESCRIPTION,
        },
        script: {
          type: 'string',
          description: 'script 渠道必填：脚本正文（每行输出一条 JSON 事实）。Host 负责把它写入状态目录。',
        },
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
        const result = value as { sourceId: string; name: string; status: string; lastError?: string }
        if (result.status === 'error') {
          return [{ type: 'text', text: `来源「${result.name}」已创建（${result.sourceId}），但启动失败：${result.lastError ?? '未知原因'}` }]
        }
        const state = result.status === 'running' ? '已开始感知' : '已创建但未启动'
        return [{ type: 'text', text: `来源「${result.name}」${state}（${result.sourceId}）` }]
      },
    },
    execute: async (rawArgs: unknown) => {
      const view = await dependencies.perception.create(rawArgs)
      return {
        sourceId: view.id,
        name: view.name,
        status: view.status,
        ...(view.lastError === undefined ? {} : { lastError: view.lastError }),
      }
    },
  }
}
