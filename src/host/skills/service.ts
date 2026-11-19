// src/host/skills/service.ts
//
// 官方 Skill 服务的最小写面。
//
// 本插件只注册一个内置技能，用不到列出与读取；声明得越窄，官方形状变化时受影响
// 的面越小。官方类型包与本插件的宿主版本不同源，因此这里不引入它的类型。

export interface SkillRegistration {
  name: string
  description: string
  /** 什么时候该用这个技能；官方目录会把它展示给模型。 */
  whenToUse?: string
  /** 来源层：运行时注册的技能用 `runtime`。 */
  source: string
  content: string
  metadata?: Readonly<Record<string, unknown>>
}

export interface SkillService {
  /** 注册一个运行时技能，返回精确的注销函数。 */
  register(skill: SkillRegistration): () => void
}
