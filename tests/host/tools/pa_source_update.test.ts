// tests/host/tools/pa_source_update.test.ts
//
// 改来源工具：只改给出字段，传了 threads 就整体替换。

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createSourceUpdateTool } from '../../../src/host/tools/pa_source_update/index.ts'
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

describe('pa_source_update', () => {
  it('renames a source without touching the rest', async () => {
    const tool = createSourceUpdateTool({ perception: fixture.service })

    const result = (await tool.execute({ sourceId, name: '改名后' }, toolContext())) as {
      sourceId: string
      name: string
      status: string
    }

    expect(result).toMatchObject({ sourceId, name: '改名后', status: 'running' })
    expect(fixture.service.definitions()[0]?.threads).toHaveLength(1)
  })

  it('replaces the thread list as a whole', async () => {
    const tool = createSourceUpdateTool({ perception: fixture.service })

    await tool.execute(
      {
        sourceId,
        threads: [
          { id: 'docs', name: '文档', enabled: true },
          { id: 'logs', name: '日志', enabled: false },
        ],
      },
      toolContext(),
    )

    expect(fixture.service.definitions()[0]?.threads.map(thread => thread.id)).toEqual(['docs', 'logs'])
  })

  it('reports an unknown source', async () => {
    const tool = createSourceUpdateTool({ perception: fixture.service })

    await expect(tool.execute({ sourceId: 'src-ghost', name: 'x' }, toolContext())).rejects.toMatchObject({
      code: 'source-not-found',
    })
  })
})
