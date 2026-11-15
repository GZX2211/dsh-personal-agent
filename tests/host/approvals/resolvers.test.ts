// tests/host/approvals/resolvers.test.ts
//
// resolver 的关键顺序：决定先送达工具，工具确认后才算完成；中止则立刻失败。

import { describe, expect, it } from 'vitest'
import {
  ApprovalCancelledError,
  ResolverRegistry,
  type ApprovalDelivery,
} from '../../../src/host/approvals/resolvers.ts'

const DELIVERY: ApprovalDelivery = {
  decision: { kind: 'selected', index: 0, label: '发布' },
  decidedAt: 1_700_000_000_000,
}

describe('ResolverRegistry', () => {
  it('delivers a decision and waits for the tool acknowledgement', async () => {
    const registry = new ResolverRegistry()
    const resolver = registry.create('a-1')
    let acknowledged = false

    const delivered = resolver.deliver(DELIVERY).then(() => {
      acknowledged = true
    })

    const received = await resolver.decision
    expect(received).toEqual(DELIVERY)
    expect(acknowledged).toBe(false)

    resolver.acknowledge()
    await delivered

    expect(acknowledged).toBe(true)
    expect(registry.find('a-1')).toBeUndefined()
  })

  it('rejects the wait when the turn is cancelled and removes the entry', async () => {
    const registry = new ResolverRegistry()
    const resolver = registry.create('a-1')

    resolver.cancel()

    await expect(resolver.decision).rejects.toBeInstanceOf(ApprovalCancelledError)
    expect(registry.find('a-1')).toBeUndefined()
  })

  it('keeps a delivered decision alive across a late cancel', async () => {
    const registry = new ResolverRegistry()
    const resolver = registry.create('a-1')
    const delivered = resolver.deliver(DELIVERY)

    resolver.cancel()
    resolver.acknowledge()

    await expect(delivered).resolves.toBe(true)
    await expect(resolver.decision).resolves.toEqual(DELIVERY)
  })

  it('treats a repeated delivery as the same hand-over', async () => {
    const registry = new ResolverRegistry()
    const resolver = registry.create('a-1')

    const first = resolver.deliver(DELIVERY)
    const second = resolver.deliver({ ...DELIVERY, decidedAt: 2 })
    resolver.acknowledge()

    await expect(first).resolves.toBe(true)
    await expect(second).resolves.toBe(true)
    await expect(resolver.decision).resolves.toEqual(DELIVERY)
  })

  it('reports a cancelled hand-over so the caller can fall back to followup', async () => {
    const registry = new ResolverRegistry()
    const resolver = registry.create('a-1')

    resolver.cancel()
    await expect(resolver.decision).rejects.toBeInstanceOf(ApprovalCancelledError)

    await expect(resolver.deliver(DELIVERY)).resolves.toBe(false)
  })

  it('rejects a duplicate registration for one approval', () => {
    const registry = new ResolverRegistry()
    registry.create('a-1')

    expect(() => registry.create('a-1')).toThrow(/already has a pending resolver/)
  })
})
