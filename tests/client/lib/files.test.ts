// tests/client/lib/files.test.ts
//
// 文件地址是宿主右侧栏唯一认得的输入：语法来自官方 util/workspace-path。
// 右侧栏文档预览只认带会话的地址；无会话的 absolute 地址不会被认领，所以这里
// 只产出 session/<sessionId>/<path> 形态。

import { describe, expect, it } from 'vitest'
import { fileName, sessionFileAddress } from '../../../src/client/lib/files.ts'

describe('sessionFileAddress', () => {
  it('encodes a Windows absolute path and keeps the drive colon', () => {
    expect(sessionFileAddress('session-1', 'D:\\pa-work\\t-1\\notes.md')).toBe(
      'dsh-resource://file/session/session-1/D:/pa-work/t-1/notes.md',
    )
  })

  it('encodes the session id and path segments, keeping reserved characters escaped', () => {
    expect(sessionFileAddress('session a/b', '/home/me/发布 稿#1.md')).toBe(
      'dsh-resource://file/session/session%20a%2Fb//home/me/%E5%8F%91%E5%B8%83%20%E7%A8%BF%231.md',
    )
  })

  it('preserves the empty first segments of a UNC path', () => {
    expect(sessionFileAddress('session-1', '\\\\server\\share\\x.txt')).toBe(
      'dsh-resource://file/session/session-1///server/share/x.txt',
    )
  })
})

describe('fileName', () => {
  it('takes the last segment of either separator style', () => {
    expect(fileName('D:\\pa-work\\t-1\\report.html')).toBe('report.html')
    expect(fileName('/home/me/notes.md')).toBe('notes.md')
  })

  it('ignores trailing separators', () => {
    expect(fileName('/home/me/')).toBe('me')
  })

  it('returns a bare file name unchanged', () => {
    expect(fileName('x.txt')).toBe('x.txt')
  })
})
