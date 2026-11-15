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
  approvalsFilterPending: '待审批',
  approvalsFilterDecided: '已通过',
  approvalsFilterAll: '全部',
  approvalsEmptyPending: '没有待审批的请求',
  approvalsEmptyDecided: '还没有已通过的审批',
  approvalsEmptyAll: '还没有审批',
  approvalsNoMatch: '没有匹配的审批',
  approvalExpand: '展开',
  approvalCollapse: '收起',
  ticketsFilterQueued: '待处理',
  ticketsFilterRunning: '进行中',
  ticketsFilterEnded: '已结束',
  ticketsFilterAll: '全部',
  ticketsSearchPlaceholder: '搜索标题、目标、汇报、时间…',
  ticketsEmptyQueued: '没有待处理的工单',
  ticketsEmptyRunning: '没有进行中的工单',
  ticketsEmptyEnded: '还没有已结束的工单',
  ticketsEmptyAll: '还没有工单',
  ticketsNoMatch: '没有匹配的工单',
  ticketStageQueued: '待处理',
  ticketStageRunning: '进行中',
  ticketStageBlocked: '阻塞中',
  ticketStageEnded: '已结束',
  ticketBlockedTag: '阻塞中',
  ticketInterruptedTag: '已中断',
  ticketQueueBusy: '排队中：执行会话忙',
  ticketQueueCapacityFull: '排队中：名额已满',
  ticketOutcomeCompleted: '已完成',
  ticketOutcomeFailed: '失败',
  ticketWorkerLabel: '执行会话',
  ticketDirectoryLabel: '目录',
  ticketReportLabel: '汇报',
  approvalTicket: '工单',
  approvalRequester: '发起者',
  approvalRequesterWorker: '执行会话',
  roleRouter: '路由会话',
  approvalRiskLabel: '风险',
  approvalRiskLow: '低',
  approvalRiskMedium: '中',
  approvalRiskHigh: '高',
  approvalNoteLabel: '补充说明',
  approvalNotePlaceholder: '可选：说明你的判断依据',
  approvalFieldsLabel: '需要填写',
  approvalChooseOption: '请选择一个选项',
  approvalRequiredHint: '请先填写必填项',
  approvalSubmit: '提交决定',
  approvalSkip: '跳过，让 worker 自行决定',
  approvalSubmitting: '提交中…',
  approvalDecidedTitle: '已通过',
  approvalSkippedTitle: '已跳过',
  approvalDecisionLabel: '决定',
  approvalSearchPlaceholder: '搜索标题、题干、选项、时间…',
  approvalConnectionLost: '连接中断，正在重试',
  approvalRefresh: '立即重试',
  approvalSubmittedInline: '决定已送达，执行会话继续',
  approvalSubmittedFollowup: '决定已保存，执行会话已唤醒',
  timeNow: '刚刚',
  timeMinutesAgo: '{n} 分钟前',
  timeHoursAgo: '{n} 小时前',
  timeDaysAgo: '{n} 天前',
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
  approvalsEmpty: 'No approvals yet',
  ticketsEmpty: 'No tickets yet',
  approvalsFilterPending: 'Pending',
  approvalsFilterDecided: 'Approved',
  approvalsFilterAll: 'All',
  approvalsEmptyPending: 'No pending requests',
  approvalsEmptyDecided: 'No approved requests yet',
  approvalsEmptyAll: 'No approvals yet',
  approvalsNoMatch: 'No matching approvals',
  approvalExpand: 'Expand',
  approvalCollapse: 'Collapse',
  ticketsFilterQueued: 'Queued',
  ticketsFilterRunning: 'Running',
  ticketsFilterEnded: 'Ended',
  ticketsFilterAll: 'All',
  ticketsSearchPlaceholder: 'Search title, goal, report, time…',
  ticketsEmptyQueued: 'No queued tickets',
  ticketsEmptyRunning: 'No running tickets',
  ticketsEmptyEnded: 'No ended tickets yet',
  ticketsEmptyAll: 'No tickets yet',
  ticketsNoMatch: 'No matching tickets',
  ticketStageQueued: 'Queued',
  ticketStageRunning: 'Running',
  ticketStageBlocked: 'Blocked',
  ticketStageEnded: 'Ended',
  ticketBlockedTag: 'Blocked',
  ticketInterruptedTag: 'Interrupted',
  ticketQueueBusy: 'Queued: the worker is busy',
  ticketQueueCapacityFull: 'Queued: all slots are busy',
  ticketOutcomeCompleted: 'Completed',
  ticketOutcomeFailed: 'Failed',
  ticketWorkerLabel: 'Worker session',
  ticketDirectoryLabel: 'Directory',
  ticketReportLabel: 'Report',
  approvalTicket: 'Ticket',
  approvalRequester: 'Requested by',
  approvalRequesterWorker: 'Worker session',
  roleRouter: 'Router session',
  approvalRiskLabel: 'Risk',
  approvalRiskLow: 'Low',
  approvalRiskMedium: 'Medium',
  approvalRiskHigh: 'High',
  approvalNoteLabel: 'Note',
  approvalNotePlaceholder: 'Optional: explain your call',
  approvalFieldsLabel: 'Fill in',
  approvalChooseOption: 'Choose one option',
  approvalRequiredHint: 'Fill the required fields first',
  approvalSubmit: 'Submit decision',
  approvalSkip: 'Skip and let the worker decide',
  approvalSubmitting: 'Submitting…',
  approvalDecidedTitle: 'Approved',
  approvalSkippedTitle: 'Skipped',
  approvalDecisionLabel: 'Decision',
  approvalSearchPlaceholder: 'Search title, question, options, time…',
  approvalConnectionLost: 'Connection lost, retrying',
  approvalRefresh: 'Retry now',
  approvalSubmittedInline: 'Decision delivered; the worker continues',
  approvalSubmittedFollowup: 'Decision saved; the worker was woken up',
  timeNow: 'just now',
  timeMinutesAgo: '{n} min ago',
  timeHoursAgo: '{n} h ago',
  timeDaysAgo: '{n} d ago',
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
