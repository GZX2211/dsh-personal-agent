// tests/host/signals/identity.test.ts
//
// signalId 是信号的身份，也是账本幂等的依据：同一条消息或同一条外部事实无论被
// 观察多少次都必须得到同一个 id，不同的事实必须得到不同的 id。

import { describe, expect, it } from 'vitest'
import { deliveredSignalId, filteredSignalId } from '../../../src/host/signals/identity.ts'

describe('deliveredSignalId', () => {
  it('returns the signal id shape', () => {
    expect(deliveredSignalId('session-1', 'msg-1')).toMatch(/^s-[0-9a-f]{10}$/)
  })

  it('is deterministic for the same message', () => {
    expect(deliveredSignalId('session-1', 'msg-1')).toBe(deliveredSignalId('session-1', 'msg-1'))
  })

  it('changes with the message', () => {
    expect(deliveredSignalId('session-1', 'msg-1')).not.toBe(deliveredSignalId('session-1', 'msg-2'))
  })

  it('changes with the session that owns the message', () => {
    // 消息 id 只在会话内唯一：两个会话里同名的消息是两条不同的输入。
    expect(deliveredSignalId('session-1', 'msg-1')).not.toBe(deliveredSignalId('session-2', 'msg-1'))
  })

  it('keeps non-ascii identifiers distinct', () => {
    expect(deliveredSignalId('会话一', '消息一')).not.toBe(deliveredSignalId('会话二', '消息一'))
  })

  it('does not confuse identifiers that contain a separator', () => {
    // 插件投递的消息 id 形如 `pa-delivery:<requestId>`，冒号是常态。
    expect(deliveredSignalId('a:b', 'c')).not.toBe(deliveredSignalId('a', 'b:c'))
    expect(deliveredSignalId('session-1', 'pa-delivery:abc')).not.toBe(
      deliveredSignalId('session-1:pa-delivery', 'abc'),
    )
  })
})

describe('filteredSignalId', () => {
  it('returns the signal id shape', () => {
    expect(filteredSignalId('src-1', 'th-1', 'file.txt:1732')).toMatch(/^s-[0-9a-f]{10}$/)
  })

  it('is deterministic for the same external fact', () => {
    expect(filteredSignalId('src-1', 'th-1', 'file.txt:1732')).toBe(
      filteredSignalId('src-1', 'th-1', 'file.txt:1732'),
    )
  })

  it('changes with the source, the thread and the external id', () => {
    const base = filteredSignalId('src-1', 'th-1', 'ext-1')

    expect(filteredSignalId('src-2', 'th-1', 'ext-1')).not.toBe(base)
    expect(filteredSignalId('src-1', 'th-2', 'ext-1')).not.toBe(base)
    expect(filteredSignalId('src-1', 'th-1', 'ext-2')).not.toBe(base)
  })

  it('never collides with a delivered signal of the same identifiers', () => {
    // 投递与过滤是两条不同的观察路径，身份空间必须分开。
    expect(filteredSignalId('session-1', 'msg-1', 'ext-1')).not.toBe(deliveredSignalId('session-1', 'msg-1'))
  })
})
