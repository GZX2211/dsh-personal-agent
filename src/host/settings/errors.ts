// src/host/settings/errors.ts
//
// 设置读写的稳定失败类别：协议层按类映射状态码，业务层按类分支。

import { ERROR_CODES, type ErrorCode } from '../../shared/api.ts'

/** 请求体或字段不合法；协议层回 400。 */
export class SettingsInputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SettingsInputError'
  }
}

/** 执行器或规则的保存基准已过期；协议层回 409。 */
export class SettingsConflictError extends Error {
  constructor(message = 'settings changed since the draft was loaded') {
    super(message)
    this.name = 'SettingsConflictError'
  }
}

/** 提示词版本的保存基准已过期；协议层回 409。 */
export class PromptConflictError extends Error {
  constructor(message = 'prompt version changed since the draft was loaded') {
    super(message)
    this.name = 'PromptConflictError'
  }
}

/** 请求的提示词版本不存在；协议层回 404。 */
export class PromptRevisionNotFoundError extends Error {
  constructor(revision: number) {
    super(`prompt revision ${revision} does not exist`)
    this.name = 'PromptRevisionNotFoundError'
  }
}

/** 把设置失败归类成契约里的稳定错误码；未知失败一律 internal。 */
export function settingsErrorCode(error: unknown): ErrorCode {
  if (error instanceof SettingsInputError) return ERROR_CODES.settingsInvalid
  if (error instanceof SettingsConflictError) return ERROR_CODES.settingsConflict
  if (error instanceof PromptConflictError) return ERROR_CODES.promptConflict
  if (error instanceof PromptRevisionNotFoundError) return ERROR_CODES.promptRevisionNotFound
  return ERROR_CODES.internal
}
