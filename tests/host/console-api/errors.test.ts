// tests/host/console-api/errors.test.ts
//
// 来源操作的失败语义：稳定错误码决定状态码，未知码降级为 internal。
// 客户端按码分支，因此这里的状态码也是契约的一部分。

import { describe, expect, it } from 'vitest'
import { ERROR_CODES } from '../../../src/shared/api.ts'
import { settingsFailure, sourceFailure } from '../../../src/host/console-api/errors.ts'
import {
  PromptConflictError,
  PromptRevisionNotFoundError,
  SettingsConflictError,
  SettingsInputError,
  settingsErrorCode,
} from '../../../src/host/settings/errors.ts'

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

describe('settingsErrorCode', () => {
  it('maps each settings failure class to its stable code', () => {
    expect(settingsErrorCode(new SettingsInputError('bad'))).toBe(ERROR_CODES.settingsInvalid)
    expect(settingsErrorCode(new SettingsConflictError())).toBe(ERROR_CODES.settingsConflict)
    expect(settingsErrorCode(new PromptConflictError())).toBe(ERROR_CODES.promptConflict)
    expect(settingsErrorCode(new PromptRevisionNotFoundError(3))).toBe(ERROR_CODES.promptRevisionNotFound)
    expect(settingsErrorCode(new Error('boom'))).toBe(ERROR_CODES.internal)
  })
})

describe('settingsFailure', () => {
  it('maps an invalid input to 400', () => {
    expect(settingsFailure(ERROR_CODES.settingsInvalid, '参数不合法')).toMatchObject({
      status: 400,
      body: { ok: false, code: ERROR_CODES.settingsInvalid },
    })
  })

  it('maps both conflict kinds to 409', () => {
    expect(settingsFailure(ERROR_CODES.settingsConflict, '旧版本').status).toBe(409)
    expect(settingsFailure(ERROR_CODES.promptConflict, '旧版本').status).toBe(409)
  })

  it('maps a missing prompt revision to 404', () => {
    expect(settingsFailure(ERROR_CODES.promptRevisionNotFound, '没有这一版').status).toBe(404)
  })

  it('keeps source codes and unknown failures on their existing mapping', () => {
    expect(settingsFailure(ERROR_CODES.sourceNotFound, '没有来源').status).toBe(404)
    expect(settingsFailure(ERROR_CODES.methodNotAllowed, '不允许')).toEqual({
      status: 500,
      body: { ok: false, code: 'internal', message: '不允许' },
    })
  })
})
