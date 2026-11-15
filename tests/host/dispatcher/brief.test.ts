// tests/host/dispatcher/brief.test.ts
//
// 简报是 worker 唯一的任务入口：缺一段信息就意味着执行者要回读总控台或猜。

import { describe, expect, it } from 'vitest'
import { formatTaskBrief, type TaskBrief } from '../../../src/host/dispatcher/brief.ts'

const BASE: TaskBrief = {
  ticketId: 't-abcdef1234',
  title: '发布新版本',
  goal: '把 v2 发布到生产',
}

describe('formatTaskBrief', () => {
  it('starts with the ticket heading and the goal', () => {
    const text = formatTaskBrief(BASE, 'dispatch')

    expect(text.startsWith('[工单] #abcdef 发布新版本')).toBe(true)
    expect(text).toContain('目标：把 v2 发布到生产')
  })

  it('carries context, constraints, acceptance criteria and directory', () => {
    const text = formatTaskBrief(
      {
        ...BASE,
        context: '用户原话：今晚发',
        constraints: ['不要改数据库', '不要动灰度开关'],
        expectedOutput: '生产返回 200 且版本号为 v2',
        directory: 'C:\\state\\work\\t-abcdef1234',
      },
      'dispatch',
    )

    expect(text).toContain('背景：用户原话：今晚发')
    expect(text).toContain('- 不要改数据库')
    expect(text).toContain('- 不要动灰度开关')
    expect(text).toContain('验收标准：生产返回 200 且版本号为 v2')
    expect(text).toContain('工作目录：C:\\state\\work\\t-abcdef1234')
  })

  it('omits optional sections that are absent', () => {
    const text = formatTaskBrief(BASE, 'dispatch')

    expect(text).not.toContain('背景：')
    expect(text).not.toContain('约束：')
    expect(text).not.toContain('验收标准：')
    expect(text).not.toContain('工作目录：')
  })

  it('marks an appended ticket and warns against redoing finished work', () => {
    const text = formatTaskBrief(BASE, 'append')

    expect(text.startsWith('[追加工单] #abcdef')).toBe(true)
    expect(text).toContain('不要重做已完成的工作')
  })

  it('always points at the approval tool and the closing report', () => {
    const text = formatTaskBrief(BASE, 'dispatch')

    expect(text).toContain('pa_approval_submit')
    expect(text).toContain('汇报')
  })
})
