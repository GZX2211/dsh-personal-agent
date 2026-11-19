// tests/host/console-api/errors.test.ts
//
// 来源操作的失败语义：稳定错误码决定状态码，未知码降级为 internal。
// 客户端按码分支，因此这里的状态码也是契约的一部分。

import { describe, expect, it } from 'vitest'
import { ERROR_CODES } from '../../../src/shared/api.ts'
import { sourceFailure } from '../../../src/host/console-api/errors.ts'

describe('sourceFailure', () => {
  it('maps a missing source to 404', () => {
    expect(sourceFailure(ERROR_CODES.sourceNotFound, '来源不存在')).toEqual({
      status: 404,
      body: { ok: false, code: 'source-not-found', message: '来源不存在' },
    })
  })

  it('maps an invalid request to 400', () => {
    expect(sourceFailure(ERROR_CODES.sourceInvalid, '参数不合法')).toMatchObject({
      status: 400,
      body: { ok: false, code: 'source-invalid' },
    })
  })

  it('maps a failed start to 502', () => {
    expect(sourceFailure(ERROR_CODES.sourceStartFailed, '启动失败')).toMatchObject({
      status: 502,
      body: { ok: false, code: 'source-start-failed' },
    })
  })

  it('falls back to internal for an unknown code', () => {
    expect(sourceFailure('something-else', '坏了')).toEqual({
      status: 500,
      body: { ok: false, code: 'internal', message: '坏了' },
    })
  })
})
