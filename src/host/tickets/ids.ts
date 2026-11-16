// src/host/tickets/ids.ts
//
// 工单 id 生成。id 是账本主键；展示短码是 Host 与 Client 共用的规则，
// 放在 `src/shared/tickets.ts`。

import { randomUUID } from 'node:crypto'

/** 新建工单 id：`t-` + 10 位十六进制。 */
export function createTicketId(): string {
  return `t-${randomUUID().replaceAll('-', '').slice(0, 10)}`
}
