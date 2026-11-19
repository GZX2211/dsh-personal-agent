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
  approvalOpenSession: '跳转会话',
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

  sourceChannelHostEvent: '内部事件',
  sourceChannelFsWatch: '本地文件',
  sourceChannelScript: '脚本',
  sourceStatusRunning: '运行中',
  sourceStatusStopped: '已停止',
  sourceStatusError: '错误',
  sourcesSection: '感知来源',
  sourcesCreateInChat: '在对话中创建',
  sourcesEmpty: '还没有感知来源。去对话里说：「盯着 …，有变化就告诉我」',
  sourcesNoMatch: '没有匹配的来源',
  sourcesLastEvent: '最近触发',
  sourcesNever: '尚未触发',
  sourcesThreadCount: '线程 {count}',
  sourceExpand: '展开',
  sourceCollapse: '折叠',
  sourceConfigPaths: '路径',
  sourceConfigEvents: '事件',
  sourceConfigCommand: '命令',
  sourceThreadDelivered: '投递 {count}',
  sourceThreadFiltered: '过滤 {count}',
  sourceTest: '测试',
  sourceTesting: '测试中…',
  sourceRestart: '重启',
  sourceRemove: '删除',
  sourceDeleting: '删除中…',
  sourceTestEmpty: '测试没有产生新信号。',
  sourceTestResult: '最近信号',
  sourceRemoveTitle: '删除这个来源？',
  sourceRemoveBody: '删除后不再感知；历史信号仍保留在事件页。',
  sourceRemoveConfirm: '删除',
  sourceRemoveCancel: '取消',
  sourceRemoveClose: '关闭',
  sourceToggleFailed: '切换失败，已恢复原状态',
  sourceRemoveFailed: '删除失败',
  sourceRemoveDone: '来源已删除',
  sourceTestFailed: '测试失败',
  timeJustNow: '刚刚',

  eventsKindFilterLabel: '事件类型',
  eventsVerdictFilterLabel: '处理方式',
  eventsKindAll: '全部类型',
  eventsVerdictAll: '全部处理',
  eventsFilterIgnored: '忽略（过滤）',
  eventListLabel: '事件列表',
  eventsEmptyAll: '还没有事件',
  eventsEmptyUser: '还没有用户消息',
  eventsEmptyTimer: '还没有定时事件',
  eventsEmptyPerception: '还没有感知事件',
  eventsEmptyFiltered: '没有被过滤的事件',
  eventsEmptyDispatch: '还没有派发的事件',
  eventsEmptyAppend: '还没有追加的事件',
  eventsEmptyReply: '还没有响应的事件',
  eventsNoMatch: '没有匹配的事件',
  eventSourceConversation: '对话',
  eventKindUser: '用户',
  eventKindTimer: '定时',
  eventKindPerception: '感知',
  eventPending: '待处理',
  eventReply: '响应',
  eventDispatch: '派发',
  eventAppend: '追加',
  eventFiltered: '已过滤',
  eventRuleMatch: '不匹配',
  eventRuleMinGap: '节流',
  eventRuleNoChange: '无变化',
  eventInferred: '推断',
  eventInferredHint: '回合结束时推断为响应，没有显式处理动作',
  eventOpenTicket: '打开工单',
  eventsSearching: '正在检索历史…',
  eventsTotal: '共 {count} 条',
  eventsHistoryHint: '搜索覆盖全部历史',
  eventsQueryFailed: '历史检索失败，请稍后重试',
  helpBodySources: '感知来源让 Agent 在你不在场时也能收到通知。创建方式：在对话里告诉它你要盯什么。',
  helpBodySourcesSearch: '搜索会匹配来源名称、说明、线程名与配置摘要。',
  helpBodyEvents: '事件页按输入类型过滤；搜索覆盖全部历史，不只是最近这一段。',

  sourceErrorNotFound: '来源不存在或已删除',
  sourceErrorInvalid: '来源参数不合法',
  sourceErrorStartFailed: '来源启动失败',
  sourceErrorUnknown: '操作失败，请稍后重试',

  decisionErrorAlreadyDecided: '这条审批已经处理过',
  decisionErrorNotFound: '审批不存在或已作废',
  decisionErrorWorkerArchived: '执行会话已归档，审批已作废',
  decisionErrorDeliveryFailed: '决定送达失败，审批已回到待审批',
  decisionErrorInvalidDecision: '决定内容不完整或选项无效',
  decisionErrorUnknown: '提交失败，请稍后重试',
}

export type Dict = typeof zh

/** 文案模板里的占位参数：`{count}` 这类花括号名字。 */
export type TranslateParams = Readonly<Record<string, string | number>>

/**
 * 组件拿到的翻译函数：键受词典约束，语言每次渲染都取自 locale 服务。
 *
 * 带占位符的文案（如「线程 {count}」）用第二个参数填充；缺省值原样保留占位符，
 * 让漏传参数在界面上可见，而不是静默变成空白。
 */
export type Translate = (key: keyof Dict, params?: TranslateParams) => string

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
  approvalOpenSession: 'Open session',
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

  sourceChannelHostEvent: 'Host events',
  sourceChannelFsWatch: 'Local files',
  sourceChannelScript: 'Script',
  sourceStatusRunning: 'Running',
  sourceStatusStopped: 'Stopped',
  sourceStatusError: 'Error',
  sourcesSection: 'Perception sources',
  sourcesCreateInChat: 'Create in conversation',
  sourcesEmpty: 'No perception sources yet. Say in conversation: "watch …, tell me when it changes".',
  sourcesNoMatch: 'No matching sources',
  sourcesLastEvent: 'Last triggered',
  sourcesNever: 'Never triggered',
  sourcesThreadCount: 'Threads {count}',
  sourceExpand: 'Expand',
  sourceCollapse: 'Collapse',
  sourceConfigPaths: 'Paths',
  sourceConfigEvents: 'Events',
  sourceConfigCommand: 'Command',
  sourceThreadDelivered: 'Delivered {count}',
  sourceThreadFiltered: 'Filtered {count}',
  sourceTest: 'Test',
  sourceTesting: 'Testing…',
  sourceRestart: 'Restart',
  sourceRemove: 'Delete',
  sourceDeleting: 'Deleting…',
  sourceTestEmpty: 'The test produced no new signal.',
  sourceTestResult: 'Latest signals',
  sourceRemoveTitle: 'Delete this source?',
  sourceRemoveBody: 'It stops watching; its past signals stay on the events page.',
  sourceRemoveConfirm: 'Delete',
  sourceRemoveCancel: 'Cancel',
  sourceRemoveClose: 'Close',
  sourceToggleFailed: 'The switch failed; the previous state was restored',
  sourceRemoveFailed: 'The source could not be deleted',
  sourceRemoveDone: 'Source deleted',
  sourceTestFailed: 'The test failed',
  timeJustNow: 'just now',

  eventsKindFilterLabel: 'Event kind',
  eventsVerdictFilterLabel: 'Handling',
  eventsKindAll: 'All kinds',
  eventsVerdictAll: 'All handling',
  eventsFilterIgnored: 'Ignored (filtered)',
  eventListLabel: 'Event list',
  eventsEmptyAll: 'No events yet',
  eventsEmptyUser: 'No user messages yet',
  eventsEmptyTimer: 'No timer events yet',
  eventsEmptyPerception: 'No perception events yet',
  eventsEmptyFiltered: 'No filtered events',
  eventsEmptyDispatch: 'No dispatched events yet',
  eventsEmptyAppend: 'No appended events yet',
  eventsEmptyReply: 'No replies yet',
  eventsNoMatch: 'No matching events',
  eventSourceConversation: 'Conversation',
  eventKindUser: 'User',
  eventKindTimer: 'Timer',
  eventKindPerception: 'Perception',
  eventPending: 'Pending',
  eventReply: 'Reply',
  eventDispatch: 'Dispatch',
  eventAppend: 'Append',
  eventFiltered: 'Filtered',
  eventRuleMatch: 'no match',
  eventRuleMinGap: 'throttled',
  eventRuleNoChange: 'no change',
  eventInferred: 'Inferred',
  eventInferredHint: 'Inferred as a reply at turn end; no handling action claimed it',
  eventOpenTicket: 'Open ticket',
  eventsSearching: 'Searching history…',
  eventsTotal: '{count} in total',
  eventsHistoryHint: 'Search covers the whole history',
  eventsQueryFailed: 'The history search failed, try again later',
  helpBodySources: 'Perception sources let the Agent reach you while you are away. To create one, tell it in conversation what to watch.',
  helpBodySourcesSearch: 'Search matches the source name, its description, thread names and the configuration summary.',
  helpBodyEvents: 'The events page filters by input kind; search covers the whole history, not only the recent window.',

  sourceErrorNotFound: 'The source does not exist or was removed',
  sourceErrorInvalid: 'The source arguments are invalid',
  sourceErrorStartFailed: 'The source failed to start',
  sourceErrorUnknown: 'The action failed, try again later',

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
  return (key, params) => interpolate(dict[key], params)
}

function interpolate(template: string, params: TranslateParams | undefined): string {
  if (params === undefined) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  )
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
