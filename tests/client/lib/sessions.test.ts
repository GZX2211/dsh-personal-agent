// tests/client/lib/sessions.test.ts
//
// 会话展示名的兜底顺序：持久标题 → 列表派生名 → undefined（由调用方回退短码）。

import { describe, expect, it } from 'vitest'
import { sessionTitleOf } from '../../../src/client/lib/sessions.ts'

const ID = 'session-19b0e213'

describe('sessionTitleOf', () => {
  it('prefers the durable title and falls back to the display name', () => {
    expect(sessionTitleOf({ byId: { [ID]: { title: '建文件 · 工单 #9c20e7', displayTitle: 'ignored' } } }, ID)).toBe(
      '建文件 · 工单 #9c20e7',
    )
    expect(sessionTitleOf({ byId: { [ID]: { displayTitle: '建文件' } } }, ID)).toBe('建文件')
  })

  it('skips blank titles and unknown sessions', () => {
    expect(sessionTitleOf({ byId: { [ID]: { title: '', displayTitle: '建文件' } } }, ID)).toBe('建文件')
    expect(sessionTitleOf({ byId: {} }, ID)).toBeUndefined()
  })

  it('returns undefined for a shape it does not recognize', () => {
    expect(sessionTitleOf(undefined, ID)).toBeUndefined()
    expect(sessionTitleOf('nope', ID)).toBeUndefined()
    expect(sessionTitleOf({ byId: null }, ID)).toBeUndefined()
  })
})
