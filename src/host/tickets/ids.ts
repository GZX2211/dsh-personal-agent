// src/host/tickets/ids.ts
//
// 工单 id 与展示短码。id 是账本主键，短码只用于会话标题、卡片与 #标签。

import { randomUUID } from 'node:crypto'

/** 新建工单 id：`t-` + 10 位十六进制。 */
export function createTicketId(): string {
  return `t-${randomUUID().replaceAll('-', '').slice(0, 10)}`
}

/** 展示短码：id 去掉前缀后的前 6 位。 */
export function shortTicketId(ticketId: string): string {
  return ticketId.replace(/^t-/, '').slice(0, 6)
}
