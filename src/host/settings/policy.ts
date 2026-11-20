// src/host/settings/policy.ts
//
// 派单规则的版本指纹：给 Router 提示词一个可展示、可对照的短版本号。
// 纯函数，只依赖规则内容本身。

import { createHash } from 'node:crypto'
import type { DispatchRule } from '../../shared/settings.ts'

/**
 * 规则集的内容指纹：改说明、改开关、改顺序都会得到新版本；同内容永远同版本。
 * 取 sha256 前 8 位，长度刚好够在界面上展示。
 */
export function policyVersionOf(rules: readonly DispatchRule[]): string {
  const canonical = JSON.stringify(
    rules.map(rule => ({
      id: rule.id,
      name: rule.name,
      instruction: rule.instruction,
      enabled: rule.enabled,
    })),
  )
  return createHash('sha256').update(canonical, 'utf8').digest('hex').slice(0, 8)
}
