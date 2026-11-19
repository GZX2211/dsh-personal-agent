// src/client/lib/sessions.ts
//
// 从会话列表快照里读一个会话的展示名。宿主把标题投影进列表行（`title`），
// 还没投影出来时行里另有 `displayTitle`；两者都没有就返回 undefined，
// 由调用方回退到短码——这里不做任何猜测。

interface SessionRowLike {
  title?: unknown
  displayTitle?: unknown
}

interface SessionListLike {
  byId?: Record<string, SessionRowLike | undefined>
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

/** 优先持久标题，其次列表派生名。 */
export function sessionTitleOf(list: unknown, sessionId: string): string | undefined {
  if (typeof list !== 'object' || list === null) return undefined
  const byId = (list as SessionListLike).byId
  if (typeof byId !== 'object' || byId === null) return undefined
  const row = byId[sessionId]
  if (typeof row !== 'object' || row === null) return undefined
  return text(row.title) ?? text(row.displayTitle)
}

/**
 * worker 会话标题以 ` · 工单 #<短码>` 结尾（Host 建会话时写入）。总控台的审批行
 * 只展示会话名，工单归属由工单页承担，所以展示前剥离这个后缀；剥离后为空时
 * 由调用方回退到短码。
 */
const TICKET_SUFFIX = /(?:^|\s*·\s*)工单\s*#[0-9A-Za-z]+\s*$/u

export function stripTicketSuffix(title: string): string {
  return title.replace(TICKET_SUFFIX, '').trim()
}
