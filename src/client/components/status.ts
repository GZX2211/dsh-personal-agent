// src/client/components/status.ts
//
// 列表状态到官方 Tag / StateDot 语汇的映射。放在组件层：TagTone 与
// StateDotState 来自官方 UI 包，lib 不得依赖任何 UI 模块。

import type { StateDotState, TagTone } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ApprovalRisk } from '../../shared/approvals.ts'
import type { TicketBadgeTone } from '../lib/tickets.ts'

/** 工单徽标色 → 官方 Tag 色调。 */
export function ticketTagTone(tone: TicketBadgeTone): TagTone {
  switch (tone) {
    case 'idle':
      return 'neutral'
    case 'business':
      return 'info'
    case 'success':
      return 'success'
    case 'warn':
      return 'warning'
    case 'error':
      return 'danger'
  }
}

/** 工单徽标色 → 官方状态点。 */
export function ticketDotState(tone: TicketBadgeTone): StateDotState {
  switch (tone) {
    case 'idle':
      return 'idle'
    case 'business':
      return 'ongoing'
    case 'success':
      return 'done'
    case 'warn':
      return 'warning'
    case 'error':
      return 'error'
  }
}

/** 审批风险 → 官方 Tag 色调。 */
export function riskTagTone(risk: ApprovalRisk): TagTone {
  switch (risk) {
    case 'low':
      return 'neutral'
    case 'medium':
      return 'warning'
    case 'high':
      return 'danger'
  }
}
