// src/host/skills/perception.ts
//
// 把「感知来源」的操作手册注册成内置技能。
//
// 注册在全局层（插件自身的 apply 上下文），因此 router 会话能看到它；技能正文随包
// 分发，改写作方式是一次可 review 的文件变更。

import type { HostContext } from '../context.ts'
import { loadSkillBody } from '../prompts/index.ts'
import type { SkillService } from './service.ts'

export const PERCEPTION_SKILL_NAME = 'perception-source'

export function registerPerceptionSkill(
  ctx: HostContext,
  log?: (message: string) => void,
): () => void {
  const skills = ctx.get('skills')
  if (skills === undefined) {
    // 宿主没挂 skill 服务时来源仍可用，只是 router 少了写作指南。
    log?.('skills 服务不可用：perception-source 未注册')
    return () => undefined
  }

  return skills.register({
    name: PERCEPTION_SKILL_NAME,
    description:
      '为用户建立长期感知来源：盯本地文件、订阅内部事件、或用常驻脚本感知外部服务。来源会把事实推给 router，不消耗模型调用。',
    whenToUse: '用户说「盯着某个东西」「有变化就告诉我」「监控一下」「自动关注」时',
    source: 'runtime',
    content: loadSkillBody(),
  })
}

export type { SkillService }
