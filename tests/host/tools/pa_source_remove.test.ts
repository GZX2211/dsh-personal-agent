// tests/host/tools/pa_source_remove.test.ts
//
// 删除工具：删掉定义与运行时状态，但已记下的事件保留——它们确实发生过。

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createSourceRemoveTool } from '../../../src/host/tools/pa_source_remove/index.ts'
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

describe('pa_source_remove', () => {
  it('removes the source from the list', async () => {
    const tool = createSourceRemoveTool({ perception: fixture.service })

    const result = (await tool.execute({ sourceId }, toolContext())) as { removed: boolean }

    expect(result.removed).toBe(true)
    expect(fixture.service.sources()).toEqual([])
    expect(fixture.store.events().map(event => event.type)).toEqual(['source/created', 'source/removed'])
  })

  it('reports a source that is already gone', async () => {
    const tool = createSourceRemoveTool({ perception: fixture.service })
    await tool.execute({ sourceId }, toolContext())

    const again = (await tool.execute({ sourceId }, toolContext())) as { removed: boolean }

    expect(again.removed).toBe(false)
  })

  it('rejects a missing source id', async () => {
    const tool = createSourceRemoveTool({ perception: fixture.service })

    await expect(tool.execute({}, toolContext())).rejects.toThrow(/sourceId/)
  })
})
