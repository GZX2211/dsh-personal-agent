// tests/host/skills/perception.test.ts
//
// 内置技能注册：正文随包分发，注册走官方的运行时技能接口；宿主没有 skill 服务时
// 降级为不注册，而不是让插件起不来。

import { describe, expect, it } from 'vitest'
import { PERCEPTION_SKILL_NAME, registerPerceptionSkill } from '../../../src/host/skills/perception.ts'
import type { SkillRegistration } from '../../../src/host/skills/service.ts'
import { createFakeHost } from '../../support/fake-host.ts'

function skillsService(): { service: { register(skill: SkillRegistration): () => void }; registrations: SkillRegistration[] } {
  const registrations: SkillRegistration[] = []
  return {
    registrations,
    service: {
      register(skill) {
        registrations.push(skill)
        return () => {
          const index = registrations.indexOf(skill)
          if (index >= 0) registrations.splice(index, 1)
        }
      },
    },
  }
}

describe('registerPerceptionSkill', () => {
  it('registers the built-in skill with its writing guide', () => {
    const host = createFakeHost()
    const skills = skillsService()

    const disposer = registerPerceptionSkill({ ...host.ctx, get: () => skills.service } as never)

    expect(skills.registrations).toHaveLength(1)
    const registration = skills.registrations[0]
    expect(registration?.name).toBe(PERCEPTION_SKILL_NAME)
    expect(registration?.source).toBe('runtime')
    expect(registration?.whenToUse).toMatch(/盯着/)
    expect(registration?.content).toContain('## 先判断该用哪种渠道')
    expect(registration?.content).toContain('## script 渠道的协议')
    expect(registration?.content).toContain('## 反例')

    disposer()
    expect(skills.registrations).toEqual([])
  })

  it('keeps the markdown structure instead of collapsing it into paragraphs', () => {
    const host = createFakeHost()
    const skills = skillsService()

    registerPerceptionSkill({ ...host.ctx, get: () => skills.service } as never)

    // 表格与代码块必须原样保留：段落拼装会把它们压成一行。
    expect(skills.registrations[0]?.content).toContain('| 盯什么 | 渠道 |')
    expect(skills.registrations[0]?.content).toContain('```js')
    expect(skills.registrations[0]?.content).toContain('```powershell')
  })

  it('degrades quietly when the host has no skill service', () => {
    const host = createFakeHost()
    const logs: string[] = []

    const disposer = registerPerceptionSkill(host.ctx, message => logs.push(message))

    expect(disposer).toBeTypeOf('function')
    expect(() => disposer()).not.toThrow()
    expect(logs.some(message => message.includes('skills 服务不可用'))).toBe(true)
  })
})
