// src/host/dispatcher/brief.ts
//
// 投递给执行会话的工单说明。它是 worker 唯一的信息入口，所以必须自解释：
// 工单目标、工作目录与执行要求都在这里，不让模型回读总控台。
// 它只转交事实，不替执行者定义背景、约束或验收标准。

import type { TaskMode } from '../../shared/events.ts'
import { shortTicketId } from '../../shared/tickets.ts'

export interface TaskBrief {
  ticketId: string
  title: string
  goal: string
  directory?: string
}

export function formatTaskBrief(brief: TaskBrief, mode: TaskMode): string {
  const heading = mode === 'append' ? '[追加工单]' : '[工单]'
  const lines = [`${heading} #${shortTicketId(brief.ticketId)} ${brief.title}`, '']

  if (mode === 'append') {
    lines.push('这是追加：本会话此前已有其他工单，只按下面的说明执行，不要重做已完成的工作。', '')
  }

  lines.push(`目标：${brief.goal}`)
  if (brief.directory !== undefined) {
    lines.push('', `工作目录：${brief.directory}`)
  }

  lines.push(
    '',
    '请开始执行。需要人类决定时调用 pa_approval_submit；结束这一单时给出一段简洁的中文汇报。',
  )
  return lines.join('\n')
}
