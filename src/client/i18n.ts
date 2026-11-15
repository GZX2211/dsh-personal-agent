// src/client/i18n.ts
//
// 中英双语文案（覆盖全部 UI 界面文案）。新增文案必须同时补 zh / en。

export const NS = 'personalAgent'

export const zh = {
  consoleTitle: '总控台',
  consoleDescription: '路由会话派发工单，执行会话等待你的审批',
  tabOverview: '概览',
  tabApprovals: '审批',
  tabTickets: '工单',
  tabEvents: '事件',
  tabSources: '来源',
  tabSettings: '设置',
  notAvailable: '暂未开放',
  notAvailableHint: '这个标签页会在 MVP 之后补上。',
  approvalsEmpty: '还没有待审批',
  ticketsEmpty: '还没有工单',
}

export type Dict = typeof zh

/** 组件拿到的翻译函数：键受词典约束，语言每次渲染都取自 locale 服务。 */
export type Translate = (key: keyof Dict) => string

export const en: Dict = {
  consoleTitle: 'Console',
  consoleDescription: 'The router session dispatches tickets; workers wait for your approval',
  tabOverview: 'Overview',
  tabApprovals: 'Approvals',
  tabTickets: 'Tickets',
  tabEvents: 'Events',
  tabSources: 'Sources',
  tabSettings: 'Settings',
  notAvailable: 'Not available yet',
  notAvailableHint: 'This tab arrives after the MVP.',
  approvalsEmpty: 'No approvals yet',
  ticketsEmpty: 'No tickets yet',
}

export function text(language: string | null | undefined): Dict {
  return String(language ?? '').toLowerCase().startsWith('zh') ? zh : en
}

/** 按语言码给出该语言的翻译函数。 */
export function translateFor(language: string | null | undefined): Translate {
  const dict = text(language)
  return key => dict[key]
}

/** 从 locale 服务取值中提取语言码 */
export function detectLanguage(locale: unknown, navigatorLanguage?: string): string {
  try {
    if (typeof locale === 'string') return locale
    if (locale && typeof locale === 'object') {
      const record = locale as {
        language?: unknown
        current?: unknown
        get?: (key: string) => unknown
        // DSH 官方 locale 服务（dsh-client-locale LocaleRuntime）形状：
        // getSnapshot() / getLocale() 均返回 { active, locales, revision }。
        getSnapshot?: () => { active?: unknown }
        getLocale?: () => { active?: unknown }
      }
      if (typeof record.language === 'string') return record.language
      if (typeof record.current === 'string') return record.current
      if (typeof record.get === 'function') {
        const value = record.get('language')
        if (typeof value === 'string') return value
      }
      // 官方 locale 服务：读 active 语言 id（'zh' / 'en'）
      if (typeof record.getSnapshot === 'function') {
        const snapshot = record.getSnapshot()
        if (snapshot && typeof snapshot.active === 'string') return snapshot.active
      }
      if (typeof record.getLocale === 'function') {
        const snapshot = record.getLocale()
        if (snapshot && typeof snapshot.active === 'string') return snapshot.active
      }
    }
  } catch {
    // 忽略
  }
  try {
    return typeof navigator !== 'undefined' ? (navigator.language ?? navigatorLanguage ?? 'en') : (navigatorLanguage ?? 'en')
  } catch {
    return navigatorLanguage ?? 'en'
  }
}
