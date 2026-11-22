// tests/host/dispatcher/brief.test.ts
//
// 工单说明是 worker 唯一的信息入口：目标与工作目录必须到位，其余由执行者判断。

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

  it('carries the working directory when it is known', () => {
    const text = formatTaskBrief(
      { ...BASE, directory: 'C:\\state\\work\\t-abcdef1234' },
      'dispatch',
    )

    expect(text).toContain('工作目录：C:\\state\\work\\t-abcdef1234')
  })

  it('omits the working directory when it is absent', () => {
    const text = formatTaskBrief(BASE, 'dispatch')

    expect(text).not.toContain('工作目录：')
  })

  it('does not carry background, constraints or acceptance criteria', () => {
    const text = formatTaskBrief({ ...BASE, directory: '/state/work/t-abcdef1234' }, 'dispatch')

    expect(text).not.toContain('背景：')
    expect(text).not.toContain('约束：')
    expect(text).not.toContain('验收标准：')
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
