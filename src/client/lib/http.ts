// src/client/lib/http.ts
//
// 唯一网络边界：只有这里发请求，组件与 hook 都经它拿数据。
// 路径、请求头与错误码来自共享契约，不在调用点硬编码。

import {
  approvalDecidePath,
  REQUEST_HEADER,
  REQUEST_HEADER_VALUE,
  ROUTES,
  type DecisionFailure,
  type DecisionRequest,
  type DecisionResponse,
  type DecisionSuccess,
  type ErrorResponse,
  type SnapshotResponse,
} from '../../shared/api.ts'

/** 服务端稳定错误码的载体：调用方按 `code` 分支，不靠文案猜。 */
export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/** 拉一次总控台视图；失败按稳定错误码抛给调用方决定文案与重试。 */
export async function fetchSnapshot(): Promise<SnapshotResponse> {
  const response = await fetch(ROUTES.snapshot, {
    method: 'GET',
    credentials: 'same-origin',
    headers: { [REQUEST_HEADER]: REQUEST_HEADER_VALUE },
  })
  return readJson<SnapshotResponse>(response)
}

/** 提交一次审批决定；成功返回送达方式，失败按错误码抛出。 */
export async function decideApproval(
  approvalId: string,
  request: DecisionRequest,
): Promise<DecisionSuccess> {
  const response = await fetch(approvalDecidePath(approvalId), {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      [REQUEST_HEADER]: REQUEST_HEADER_VALUE,
      'content-type': 'application/json',
    },
    body: JSON.stringify(request),
  })
  const payload = await readJson<DecisionResponse>(response)
  if (payload.ok !== true) throw failure(payload, response.status)
  return payload
}

async function readJson<T>(response: Response): Promise<T> {
  const payload: unknown = await response.json().catch(() => undefined)
  if (!response.ok) {
    const failureBody = payload as ErrorResponse | undefined
    throw new ApiError(
      failureBody?.code ?? 'http-error',
      failureBody?.message ?? `HTTP ${response.status}`,
      response.status,
    )
  }
  return payload as T
}

function failure(body: DecisionFailure, status: number): ApiError {
  return new ApiError(body.code, body.message, status)
}
