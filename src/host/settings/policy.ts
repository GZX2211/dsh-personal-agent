// src/host/settings/policy.ts
//
// 策略的版本指纹：派单规则与决策权限共用同一个版本号，给 Router 与 Worker
// 的提示词一个可展示、可对照的短版本。纯函数，只依赖两份规则内容本身。

import { createHash } from 'node:crypto'
import type { DispatchRule } from '../../shared/settings.ts'

interface CanonicalRule {
  id: string
  name: string
  instruction: string
  enabled: boolean
}

function canonicalRules(rules: readonly DispatchRule[]): CanonicalRule[] {
  return rules.map(rule => ({
    id: rule.id,
    name: rule.name,
    instruction: rule.instruction,
    enabled: rule.enabled,
  }))
}

/**
 * 策略版本：改任意一套规则的内容、开关或顺序都会得到新版本；同内容永远同版本。
 * 两套规则一起参与指纹，所以只改决策权限也会让页面上的策略版本更新。
 * 取 sha256 前 8 位，长度刚好够在界面上展示。
 */
export function policyVersionOf(
  rules: readonly DispatchRule[],
  permissions: readonly DispatchRule[],
): string {
  const canonical = JSON.stringify({
    rules: canonicalRules(rules),
    permissions: canonicalRules(permissions),
  })
  return createHash('sha256').update(canonical, 'utf8').digest('hex').slice(0, 8)
}
