// tests/host/settings/policy.test.ts
//
// 策略版本是两套规则共同的指纹：同一份策略永远得到同一个短版本号，改任意
// 一套的内容、开关或顺序都会得到新版本。

import { describe, expect, it } from 'vitest'
import type { DispatchRule } from '../../../src/shared/settings.ts'
import { policyVersionOf } from '../../../src/host/settings/policy.ts'

function rule(overrides: Partial<DispatchRule> = {}): DispatchRule {
  return {
    id: 'rule-a',
    name: '文案修正',
    instruction: '修正错别字',
    enabled: true,
    ...overrides,
  }
}

function permission(overrides: Partial<DispatchRule> = {}): DispatchRule {
  return rule({ id: 'rule-p', name: '提交审批', instruction: '改动生产数据前问人', ...overrides })
}

describe('policyVersionOf', () => {
  it('is stable for the same rules and permissions', () => {
    expect(policyVersionOf([rule()], [permission()])).toBe(policyVersionOf([rule()], [permission()]))
    expect(policyVersionOf([rule()], [permission()])).toMatch(/^[0-9a-f]{8}$/)
  })

  it('changes when either rule set changes content, switch or order', () => {
    const base = policyVersionOf([rule()], [permission()])

    expect(policyVersionOf([rule({ instruction: '修正标点' })], [permission()])).not.toBe(base)
    expect(policyVersionOf([rule({ enabled: false })], [permission()])).not.toBe(base)
    expect(policyVersionOf([rule()], [permission({ enabled: false })])).not.toBe(base)
    expect(policyVersionOf([rule()], [permission({ instruction: '先问人' })])).not.toBe(base)
    expect(policyVersionOf([rule(), rule({ id: 'rule-b', name: '视觉修正' })], [permission()])).not.toBe(
      policyVersionOf([rule({ id: 'rule-b', name: '视觉修正' }), rule()], [permission()]),
    )
    expect(policyVersionOf([rule()], [permission(), rule({ id: 'rule-b', name: '视觉修正' })])).not.toBe(
      policyVersionOf([rule()], [rule({ id: 'rule-b', name: '视觉修正' }), permission()]),
    )
  })

  it('distinguishes dispatch rules from permissions with the same content', () => {
    expect(policyVersionOf([rule()], [])).not.toBe(policyVersionOf([], [rule()]))
  })

  it('has a fixed version for the empty policy', () => {
    expect(policyVersionOf([], [])).toBe(policyVersionOf([], []))
    expect(policyVersionOf([], [])).toMatch(/^[0-9a-f]{8}$/)
  })
})
