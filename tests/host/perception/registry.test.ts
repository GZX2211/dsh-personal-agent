// tests/host/perception/registry.test.ts
//
// Channel 注册表：来源定义里的 kind 与运行体之间的对应关系只有这一份。

import { describe, expect, it } from 'vitest'
import { createChannelRegistry } from '../../../src/host/perception/registry.ts'
import { CHANNEL_KINDS } from '../../../src/shared/sources.ts'

describe('createChannelRegistry', () => {
  it('resolves every built-in channel kind', () => {
    const registry = createChannelRegistry({ stateDirectory: 'D:/state' })

    for (const kind of CHANNEL_KINDS) {
      expect(registry.factoryFor(kind), kind).toBeTypeOf('function')
    }
  })

  it('creates a runtime from the resolved factory', () => {
    const registry = createChannelRegistry({ stateDirectory: 'D:/state' })
    const factory = registry.factoryFor('host-event')
    if (factory === undefined) throw new Error('host-event factory is missing')

    const runtime = factory({
      sourceId: 'src-1',
      channel: { kind: 'host-event', subscriptions: [] },
      threads: [{ id: 't', name: '线程', enabled: true }],
      emit: () => undefined,
      warn: () => undefined,
    })

    expect(runtime.start).toBeTypeOf('function')
  })
})
