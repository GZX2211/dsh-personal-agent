// src/host/console-api/errors.ts
//
// 来源操作的失败语义：稳定错误码 → HTTP 状态码。
//
// 这里只认契约里的码，不认识的一律 internal：把未知失败伪装成 4xx 会让客户端
// 以为请求有错、也掩盖了服务端故障。

import { ERROR_CODES, type ErrorResponse } from '../../shared/api.ts'

export interface FailureOutcome {
  status: number
  body: ErrorResponse
}

export function sourceFailure(code: string, message: string): FailureOutcome {
  switch (code) {
    case ERROR_CODES.sourceNotFound:
      return { status: 404, body: { ok: false, code: ERROR_CODES.sourceNotFound, message } }
    case ERROR_CODES.sourceInvalid:
      return { status: 400, body: { ok: false, code: ERROR_CODES.sourceInvalid, message } }
    case ERROR_CODES.sourceStartFailed:
      return { status: 502, body: { ok: false, code: ERROR_CODES.sourceStartFailed, message } }
    default:
      return { status: 500, body: { ok: false, code: ERROR_CODES.internal, message } }
  }
}
