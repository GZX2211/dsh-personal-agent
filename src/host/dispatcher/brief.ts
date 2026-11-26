// src/host/dispatcher/brief.ts
//
// 投递给执行会话的工单说明。它只转交工单事实：标题、目标，append 时附一句提醒。
// 角色要求、审批工具用法与汇报格式由 worker 提示词提供，这里不重复；
// 也不替执行者定义背景、约束或验收标准。

import type { TaskMode } from '../../shared/events.ts'
import { shortTicketId } from '../../shared/tickets.ts'

export interface TaskBrief {
  ticketId: string
  title: string
  goal: string
}

export function formatTaskBrief(brief: TaskBrief, mode: TaskMode): string {
  const heading = mode === 'append' ? '[追加工单]' : '[工单]'
  const lines = [`${heading} #${shortTicketId(brief.ticketId)} ${brief.title}`, '']

  if (mode === 'append') {
    lines.push('这是追加：本会话此前已有其他工单，只按下面的说明执行，不要重做已完成的工作。', '')
  }

  lines.push(`目标：${brief.goal}`)
  return lines.join('\n')
}
