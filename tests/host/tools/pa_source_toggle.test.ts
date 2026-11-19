// tests/host/tools/pa_source_toggle.test.ts
//
// 开关工具：一条语义化操作，参数校验在工具边界完成（服务只接受布尔开关）。

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createSourceToggleTool } from '../../../src/host/tools/pa_source_toggle/index.ts'
import {
  createPerceptionFixture,
  toolContext,
  watchSourceInput,
  type PerceptionFixture,
} from '../../support/perception-fixture.ts'

let fixture: PerceptionFixture
let sourceId: string

beforeEach(async () => {
  fixture = await createPerceptionFixture()
  const created = await fixture.service.create(watchSourceInput(fixture.watchDirectory))
  sourceId = created.id
})

afterEach(async () => {
  await fixture.close()
})

describe('pa_source_toggle', () => {
  it('switches a source off', async () => {
    const tool = createSourceToggleTool({ perception: fixture.service })

    const result = (await tool.execute({ sourceId, enabled: false }, toolContext())) as {
      enabled: boolean
      status: string
    }

    expect(result).toMatchObject({ enabled: false, status: 'stopped' })
    expect(fixture.service.sources()[0]?.enabled).toBe(false)
  })

  it('switches it back on', async () => {
    const tool = createSourceToggleTool({ perception: fixture.service })
    await tool.execute({ sourceId, enabled: false }, toolContext())

    const result = (await tool.execute({ sourceId, enabled: true }, toolContext())) as { status: string }

    expect(result.status).toBe('running')
  })

  it('rejects a missing or non-boolean switch', async () => {
    const tool = createSourceToggleTool({ perception: fixture.service })

    await expect(tool.execute({ sourceId }, toolContext())).rejects.toThrow(/enabled/)
    await expect(tool.execute({ enabled: true }, toolContext())).rejects.toThrow(/sourceId/)
  })

  it('reports an unknown source', async () => {
    const tool = createSourceToggleTool({ perception: fixture.service })

    await expect(tool.execute({ sourceId: 'src-ghost', enabled: true }, toolContext())).rejects.toMatchObject({
      code: 'source-not-found',
    })
  })
})
