// tests/host/signals/claim.test.ts
//
// 认领是「信号 ↔ 处理动作」的配对规则：处理类工具按到达顺序取用本回合的信号，
// 回合结束时把没被取用的那些交给兜底结算。配对只能发生一次。

import { describe, expect, it } from 'vitest'
import { createClaimRegistry } from '../../../src/host/signals/claim.ts'

function deliver(
  registry: ReturnType<typeof createClaimRegistry>,
  messageId: string,
  signalId: string,
  turn: number,
): void {
  registry.record(messageId, signalId)
  registry.onClaimed(messageId, turn)
}

describe('ClaimRegistry', () => {
  it('claims nothing when the turn has no signal', () => {
    const registry = createClaimRegistry()

    expect(registry.claim(1)).toEqual({ ok: true })
    expect(registry.settle(1)).toEqual([])
  })

  it('claims the signals of a turn in arrival order', () => {
    const registry = createClaimRegistry()
    deliver(registry, 'msg-1', 's-aaaaaaaaaa', 1)
    deliver(registry, 'msg-2', 's-bbbbbbbbbb', 1)

    expect(registry.claim(1)).toEqual({ ok: true, signalId: 's-aaaaaaaaaa' })
    expect(registry.claim(1)).toEqual({ ok: true, signalId: 's-bbbbbbbbbb' })
    expect(registry.claim(1)).toEqual({ ok: true })
  })

  it('honours an explicit signal and leaves the others pending', () => {
    const registry = createClaimRegistry()
    deliver(registry, 'msg-1', 's-aaaaaaaaaa', 1)
    deliver(registry, 'msg-2', 's-bbbbbbbbbb', 1)

    expect(registry.claim(1, 's-bbbbbbbbbb')).toEqual({ ok: true, signalId: 's-bbbbbbbbbb' })
    expect(registry.claim(1)).toEqual({ ok: true, signalId: 's-aaaaaaaaaa' })
  })

  it('rejects an explicit signal that this turn does not own', () => {
    const registry = createClaimRegistry()
    deliver(registry, 'msg-1', 's-aaaaaaaaaa', 1)
    deliver(registry, 'msg-2', 's-bbbbbbbbbb', 2)

    expect(registry.claim(1, 's-bbbbbbbbbb')).toEqual({ ok: false, reason: 'unknown-signal' })
    expect(registry.claim(1, 's-ghost00000')).toEqual({ ok: false, reason: 'unknown-signal' })
  })

  it('rejects an explicit signal that was already claimed', () => {
    const registry = createClaimRegistry()
    deliver(registry, 'msg-1', 's-aaaaaaaaaa', 1)
    registry.claim(1)

    expect(registry.claim(1, 's-aaaaaaaaaa')).toEqual({ ok: false, reason: 'unknown-signal' })
  })

  it('settles the unclaimed signals of a turn and clears them', () => {
    const registry = createClaimRegistry()
    deliver(registry, 'msg-1', 's-aaaaaaaaaa', 1)
    deliver(registry, 'msg-2', 's-bbbbbbbbbb', 1)
    registry.claim(1)

    expect(registry.settle(1)).toEqual(['s-bbbbbbbbbb'])
    expect(registry.settle(1)).toEqual([])
    expect(registry.claim(1)).toEqual({ ok: true })
  })

  it('keeps turns isolated from each other', () => {
    const registry = createClaimRegistry()
    deliver(registry, 'msg-1', 's-aaaaaaaaaa', 1)
    deliver(registry, 'msg-2', 's-bbbbbbbbbb', 2)

    expect(registry.claim(2)).toEqual({ ok: true, signalId: 's-bbbbbbbbbb' })
    expect(registry.settle(1)).toEqual(['s-aaaaaaaaaa'])
  })

  it('ignores a message that was never recorded as a signal', () => {
    const registry = createClaimRegistry()

    registry.onClaimed('msg-ghost', 1)

    expect(registry.settle(1)).toEqual([])
  })

  it('keeps one signal for a message recorded twice', () => {
    const registry = createClaimRegistry()
    registry.record('msg-1', 's-aaaaaaaaaa')
    registry.record('msg-1', 's-bbbbbbbbbb')
    registry.onClaimed('msg-1', 1)

    expect(registry.settle(1)).toEqual(['s-aaaaaaaaaa'])
  })

  it('does not let the same signal enter two turns', () => {
    const registry = createClaimRegistry()
    registry.record('msg-1', 's-aaaaaaaaaa')
    registry.onClaimed('msg-1', 1)
    registry.onClaimed('msg-1', 2)

    expect(registry.settle(1)).toEqual(['s-aaaaaaaaaa'])
    expect(registry.settle(2)).toEqual([])
  })

  it('hands out a settled list the caller cannot mutate', () => {
    const registry = createClaimRegistry()
    deliver(registry, 'msg-1', 's-aaaaaaaaaa', 1)

    const settled = registry.settle(1)
    settled.push('s-ffffffffff')

    expect(registry.claim(1)).toEqual({ ok: true })
  })

  it('ignores a turn that never started', () => {
    const registry = createClaimRegistry()
    deliver(registry, 'msg-1', 's-aaaaaaaaaa', 2)

    expect(registry.settle(0)).toEqual([])
    expect(registry.claim(0)).toEqual({ ok: true })
    expect(registry.settle(2)).toEqual(['s-aaaaaaaaaa'])
  })
})
