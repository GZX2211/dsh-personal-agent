// src/client/components/settings/errors.ts
//
// 设置保存失败的文案映射：稳定错误码优先，未知失败用调用点给的兜底文案。

import { ERROR_CODES } from '../../../shared/api.ts'
import { ApiError } from '../../lib/http.ts'
import type { Translate } from '../../i18n.ts'

export function settingsErrorText(t: Translate, error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback
  switch (error.code) {
    case ERROR_CODES.settingsConflict:
    case ERROR_CODES.promptConflict:
      return t('settingsConflict')
    case ERROR_CODES.settingsInvalid:
      return t('settingsInvalid')
    case ERROR_CODES.promptRevisionNotFound:
      return t('settingsPromptLoadFailed')
    default:
      return fallback
  }
}
