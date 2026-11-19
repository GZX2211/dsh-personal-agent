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
  searchPlaceholder: '搜索',
  helpOpen: '帮助',
  helpTitle: '这个面板能做什么',
  helpBodyPending: '「待审批」只列出还在等你的请求：选一个选项、写一句话，或直接跳过。',
  helpBodyDecided: '「已通过」列出已经处理过的请求，点开可以看到当时的决定与时间。',
  helpBodyTickets: '「进行中」包含阻塞中与已中断的工单：它们仍占着执行槽位。',
  helpBodySearch: '搜索会同时匹配题干、选项、附件与工单信息，并与上方的筛选取交集。',
  helpClose: '知道了',

  approvalsFilterPending: '待审批',
  approvalsFilterDecided: '已通过',
  approvalsFilterAll: '全部',
  approvalListLabel: '审批列表',
  approvalStatusPending: '待审批',
  approvalRiskLabel: '风险',
  approvalsEmptyPending: '没有待审批的请求',
  approvalsEmptyDecided: '还没有已通过的审批',
  approvalsEmptyAll: '还没有审批',
  approvalsNoMatch: '没有匹配的审批',
  approvalRiskLow: '低',
  approvalRiskMedium: '中',
  approvalRiskHigh: '高',
  approvalChooseOption: '请选择一个选项',
  approvalAnswerPlaceholder: '输入你的答案',
  approvalSkip: '跳过',
  approvalSubmit: '提交',
  approvalSubmitting: '提交中…',
  approvalDecidedTitle: '已通过',
  approvalSkippedTitle: '已跳过',
  approvalExpand: '展开',
  approvalCollapse: '折叠',
  approvalConnectionLost: '连接中断，正在重试',
  approvalRefresh: '立即重试',
  approvalSubmittedInline: '决定已送达，执行会话继续',
  approvalSubmittedFollowup: '决定已保存，执行会话已唤醒',
  attachmentsLabel: '附件',
  attachmentsOpenHint: '点击可在右侧栏打开',

  ticketsFilterQueued: '待处理',
  ticketsFilterRunning: '进行中',
  ticketsFilterEnded: '已结束',
  ticketsFilterAll: '全部',
  ticketListLabel: '工单列表',
  ticketsEmptyQueued: '没有待处理的工单',
  ticketsEmptyRunning: '没有进行中的工单',
  ticketsEmptyEnded: '还没有结束的工单',
  ticketsEmptyAll: '还没有工单',
  ticketsNoMatch: '没有匹配的工单',
  ticketLabel: '工单',
  ticketStageQueued: '待处理',
  ticketStageRunning: '进行中',
  ticketStageBlocked: '阻塞中',
  ticketStageEnded: '已结束',
  ticketQueueBusy: '等待空闲槽位',
  ticketQueueCapacityFull: '名额已满',
  ticketOutcomeCompleted: '已完成',
  ticketOutcomeFailed: '失败',
  ticketTagBlocked: '阻塞中',
  ticketTagInterrupted: '已中断',

  decisionErrorAlreadyDecided: '这条审批已经处理过',
  decisionErrorNotFound: '审批不存在或已作废',
  decisionErrorWorkerArchived: '执行会话已归档，审批已作废',
  decisionErrorDeliveryFailed: '决定送达失败，审批已回到待审批',
  decisionErrorInvalidDecision: '决定内容不完整或选项无效',
  decisionErrorUnknown: '提交失败，请稍后重试',
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
  searchPlaceholder: 'Search',
  helpOpen: 'Help',
  helpTitle: 'What this panel does',
  helpBodyPending: 'Pending lists the requests still waiting on you: pick an option, type an answer, or skip.',
  helpBodyDecided: 'Approved lists the requests you already handled; open one to see the decision and its time.',
  helpBodyTickets: 'Running includes blocked and interrupted tickets: they still hold an execution slot.',
  helpBodySearch: 'Search matches the question, options, attachments and ticket details, and narrows the filters above.',
  helpClose: 'Got it',

  approvalsFilterPending: 'Pending',
  approvalsFilterDecided: 'Approved',
  approvalsFilterAll: 'All',
  approvalListLabel: 'Approval list',
  approvalStatusPending: 'Pending',
  approvalRiskLabel: 'Risk',
  approvalsEmptyPending: 'No pending requests',
  approvalsEmptyDecided: 'No approved requests yet',
  approvalsEmptyAll: 'No approvals yet',
  approvalsNoMatch: 'No matching approvals',
  approvalRiskLow: 'Low',
  approvalRiskMedium: 'Medium',
  approvalRiskHigh: 'High',
  approvalChooseOption: 'Choose one option',
  approvalAnswerPlaceholder: 'Type your answer',
  approvalSkip: 'Skip',
  approvalSubmit: 'Submit',
  approvalSubmitting: 'Submitting…',
  approvalDecidedTitle: 'Approved',
  approvalSkippedTitle: 'Skipped',
  approvalExpand: 'Expand',
  approvalCollapse: 'Collapse',
  approvalConnectionLost: 'Connection lost, retrying',
  approvalRefresh: 'Retry now',
  approvalSubmittedInline: 'Decision delivered; the worker continues',
  approvalSubmittedFollowup: 'Decision saved; the worker was woken up',
  attachmentsLabel: 'Attachments',
  attachmentsOpenHint: 'Click to open in the sidebar',

  ticketsFilterQueued: 'Queued',
  ticketsFilterRunning: 'Running',
  ticketsFilterEnded: 'Ended',
  ticketsFilterAll: 'All',
  ticketListLabel: 'Ticket list',
  ticketsEmptyQueued: 'No queued tickets',
  ticketsEmptyRunning: 'No running tickets',
  ticketsEmptyEnded: 'No ended tickets yet',
  ticketsEmptyAll: 'No tickets yet',
  ticketsNoMatch: 'No matching tickets',
  ticketLabel: 'Ticket',
  ticketStageQueued: 'Queued',
  ticketStageRunning: 'Running',
  ticketStageBlocked: 'Blocked',
  ticketStageEnded: 'Ended',
  ticketQueueBusy: 'Waiting for a free slot',
  ticketQueueCapacityFull: 'Slots are full',
  ticketOutcomeCompleted: 'Completed',
  ticketOutcomeFailed: 'Failed',
  ticketTagBlocked: 'Blocked',
  ticketTagInterrupted: 'Interrupted',

  decisionErrorAlreadyDecided: 'This approval was already handled',
  decisionErrorNotFound: 'Approval not found or discarded',
  decisionErrorWorkerArchived: 'The worker session is archived; the approval was discarded',
  decisionErrorDeliveryFailed: 'Delivery failed; the approval is pending again',
  decisionErrorInvalidDecision: 'The decision is incomplete or the option is invalid',
  decisionErrorUnknown: 'Submit failed, try again later',
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
