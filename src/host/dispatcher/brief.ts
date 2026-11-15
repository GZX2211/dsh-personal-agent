// src/host/dispatcher/brief.ts
//
// 投递给执行会话的任务简报。它是 worker 唯一的任务入口，所以必须自解释：
// 目标、背景、约束、验收标准与工作目录都在这里，不让模型回读总控台。

import type { TaskMode } from '../../shared/events.ts'
import { shortTicketId } from '../tickets/ids.ts'

export interface TaskBrief {
  ticketId: string
  title: string
  goal: string
  context?: string
  constraints?: string[]
  expectedOutput?: string
  directory?: string
}

export function formatTaskBrief(brief: TaskBrief, mode: TaskMode): string {
  const heading = mode === 'append' ? '[追加工单]' : '[工单]'
  const lines = [`${heading} #${shortTicketId(brief.ticketId)} ${brief.title}`, '']

  if (mode === 'append') {
    lines.push('这是追加：本会话此前已有其他工单，只按下面的简报执行，不要重做已完成的工作。', '')
  }

  lines.push(`目标：${brief.goal}`)
  if (brief.context !== undefined && brief.context.trim().length > 0) {
    lines.push('', `背景：${brief.context.trim()}`)
  }
  if (brief.constraints !== undefined && brief.constraints.length > 0) {
    lines.push('', '约束：', ...brief.constraints.map(item => `- ${item}`))
  }
  if (brief.expectedOutput !== undefined && brief.expectedOutput.trim().length > 0) {
    lines.push('', `验收标准：${brief.expectedOutput.trim()}`)
  }
  if (brief.directory !== undefined) {
    lines.push('', `工作目录：${brief.directory}`)
  }

  lines.push(
    '',
    '请开始执行。需要人类决定时调用 pa_approval_submit；结束这一单时给出一段简洁的中文汇报。',
  )
  return lines.join('\n')
}
