// tests/host/tools/pa_source_create.test.ts
//
// 建来源工具是模型与来源服务之间的薄适配层：参数原样交给服务，结果翻译成模型
// 能读的字段。失败语义由服务给出（source-invalid），工具不自行发明错误码。

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createSourceCreateTool } from '../../../src/host/tools/pa_source_create/index.ts'
import {
  createPerceptionFixture,
  toolContext,
  watchSourceInput,
  type PerceptionFixture,
} from '../../support/perception-fixture.ts'

let fixture: PerceptionFixture

beforeEach(async () => {
  fixture = await createPerceptionFixture()
})

afterEach(async () => {
  await fixture.close()
})

describe('pa_source_create', () => {
  it('creates a source and reports its runtime status', async () => {
    const tool = createSourceCreateTool({ perception: fixture.service })

    const result = (await tool.execute(watchSourceInput(fixture.watchDirectory), toolContext())) as {
      sourceId: string
      name: string
      status: string
    }

    expect(result.sourceId).toMatch(/^src-[0-9a-f]{10}$/)
    expect(result.name).toBe('本地文件')
    expect(result.status).toBe('running')
    expect(fixture.store.events().map(event => event.type)).toEqual(['source/created'])
  })

  it('passes validation errors through', async () => {
    const tool = createSourceCreateTool({ perception: fixture.service })

    await expect(tool.execute({ name: '' }, toolContext())).rejects.toMatchObject({ code: 'source-invalid' })
    expect(fixture.store.events()).toEqual([])
  })

  it('reports a channel that cannot start instead of failing the create', async () => {
    const tool = createSourceCreateTool({ perception: fixture.service })

    const result = (await tool.execute(
      {
        name: '不存在的目录',
        channel: { kind: 'fs-watch', paths: [`${fixture.watchDirectory}/missing`] },
        threads: [{ id: 'changes', name: '变更', enabled: true }],
      },
      toolContext(),
    )) as { status: string; lastError?: string }

    expect(result.status).toBe('error')
    expect(result.lastError).toMatch(/路径不存在/)
  })
})
