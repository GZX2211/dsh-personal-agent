// tests/host/dispatcher/brief.test.ts
//
// 工单说明只转交工单事实：标题与目标。执行要求由 worker 提示词提供，不在这里重复。

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

  it('does not carry the working directory', () => {
    const text = formatTaskBrief(BASE, 'dispatch')

    expect(text).not.toContain('工作目录')
  })

  it('does not repeat the execution instructions from the worker prompt', () => {
    const text = formatTaskBrief(BASE, 'dispatch')

    expect(text).not.toContain('pa_approval_submit')
    expect(text).not.toContain('汇报')
    expect(text).not.toContain('请开始执行')
  })

  it('does not carry background, constraints or acceptance criteria', () => {
    const text = formatTaskBrief(BASE, 'dispatch')

    expect(text).not.toContain('背景：')
    expect(text).not.toContain('约束：')
    expect(text).not.toContain('验收标准：')
  })

  it('marks an appended ticket and warns against redoing finished work', () => {
    const text = formatTaskBrief(BASE, 'append')

    expect(text.startsWith('[追加工单] #abcdef')).toBe(true)
    expect(text).toContain('不要重做已完成的工作')
  })

})
