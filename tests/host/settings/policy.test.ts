// tests/host/settings/policy.test.ts
//
// 策略版本是规则集的指纹：同一组规则永远得到同一个短版本号，改内容、改开关、
// 改顺序都会得到新版本。

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

describe('policyVersionOf', () => {
  it('is stable for the same rules', () => {
    expect(policyVersionOf([rule()])).toBe(policyVersionOf([rule()]))
    expect(policyVersionOf([rule()])).toMatch(/^[0-9a-f]{8}$/)
  })

  it('changes when the instruction, the switch or the order changes', () => {
    const base = policyVersionOf([rule()])

    expect(policyVersionOf([rule({ instruction: '修正标点' })])).not.toBe(base)
    expect(policyVersionOf([rule({ enabled: false })])).not.toBe(base)
    expect(policyVersionOf([rule(), rule({ id: 'rule-b', name: '视觉修正' })])).not.toBe(
      policyVersionOf([rule({ id: 'rule-b', name: '视觉修正' }), rule()]),
    )
  })

  it('has a fixed version for the empty rule set', () => {
    expect(policyVersionOf([])).toBe(policyVersionOf([]))
    expect(policyVersionOf([])).toMatch(/^[0-9a-f]{8}$/)
  })
})
