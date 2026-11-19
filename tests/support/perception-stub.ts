// tests/support/perception-stub.ts
//
// 只给「不经过感知逻辑」的测试用的空实现：装饰器测试关心的是工具注册，
// 集成测试关心的是工单流；它们都不需要真实的来源服务。

import type { PerceptionService } from '../../src/host/perception/service.ts'

export function perceptionStub(): PerceptionService {
  return {
    start: async () => undefined,
    stop: () => undefined,
    sources: () => [],
    definitions: () => [],
    create: async () => {
      throw new Error('perception stub: create is not available in this test')
    },
    update: async () => {
      throw new Error('perception stub: update is not available in this test')
    },
    toggle: async () => {
      throw new Error('perception stub: toggle is not available in this test')
    },
    test: async () => {
      throw new Error('perception stub: test is not available in this test')
    },
    remove: async () => false,
  }
}
