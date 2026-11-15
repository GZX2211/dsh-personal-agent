// tests/client/lib/files.test.ts
//
// 文件地址是宿主右侧栏唯一认得的输入：语法来自官方 util/workspace-path，
// 这里只负责把绝对路径编码成地址，以及从路径取一个可读名。

import { describe, expect, it } from 'vitest'
import { absoluteFileAddress, fileName } from '../../../src/client/lib/files.ts'

describe('absoluteFileAddress', () => {
  it('encodes a Windows path and keeps the drive colon', () => {
    expect(absoluteFileAddress('D:\\pa-work\\t-1\\notes.md')).toBe(
      'dsh-resource://file/absolute/D:/pa-work/t-1/notes.md',
    )
  })

  it('encodes spaces and reserved characters per segment', () => {
    expect(absoluteFileAddress('/home/me/发布 稿#1.md')).toBe(
      'dsh-resource://file/absolute/home/me/%E5%8F%91%E5%B8%83%20%E7%A8%BF%231.md',
    )
  })

  it('keeps the empty first segment of a UNC path', () => {
    expect(absoluteFileAddress('\\\\server\\share\\x.txt')).toBe(
      'dsh-resource://file/absolute//server/share/x.txt',
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
