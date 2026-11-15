// tests/client/components/console-views.test.tsx
//
// P3 视图的渲染契约：胶囊与搜索条的默认形态、空态文案取自词典、卡片折叠/只读
// 两种形态，以及审批 Tab 的待审批徽标。用服务端静态渲染，不依赖浏览器 DOM。

import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ApprovalView } from '../../../src/shared/approvals.ts'
import type { TicketView } from '../../../src/shared/tickets.ts'
import type { SnapshotResponse } from '../../../src/shared/api.ts'
import { ConsoleTabStrip } from '../../../src/client/components/ConsoleTabStrip.tsx'
import { ApprovalCard } from '../../../src/client/components/ApprovalCard.tsx'
import { TicketCard } from '../../../src/client/components/TicketCard.tsx'
import { Approvals } from '../../../src/client/views/Approvals.tsx'
import { Tickets } from '../../../src/client/views/Tickets.tsx'
import { translateFor } from '../../../src/client/i18n.ts'
import type { SnapshotHandle } from '../../../src/client/hooks/useSnapshot.ts'

const t = translateFor('zh')
const NOW = 1_700_000_000_000

function snapshot(overrides: Partial<SnapshotResponse> = {}): SnapshotResponse {
  return {
    tickets: [],
    approvals: [],
    stats: {
      tickets: { queued: 0, running: 0, blocked: 0, ended: 0, total: 0 },
      approvals: { pending: 0, decided: 0 },
    },
    ...overrides,
  }
}

function handle(data?: SnapshotResponse): SnapshotHandle {
  return { snapshot: data, refresh: () => undefined }
}

function approval(overrides: Partial<ApprovalView> = {}): ApprovalView {
  return {
    id: 'a-684460e5f9',
    ticketId: 't-7380b609ef',
    title: '测试审批',
    question: '是否继续？',
    options: [{ label: '批准', description: '继续' }],
    fields: [],
    requestedBySessionId: 'session-19b0e213',
    createdAt: NOW,
    ...overrides,
  }
}

function ticket(overrides: Partial<TicketView> = {}): TicketView {
  return {
    id: 't-9c20e78bca',
    shortId: '9c20e7',
    title: '建文件',
    stage: 'running',
    goal: '在 D:\\tmp 下创建 hello.txt',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

describe('Approvals view', () => {
  it('opens on the pending capsule with a search field and no pending requests', () => {
    const html = renderToStaticMarkup(<Approvals t={t} language="zh" data={handle(snapshot())} />)

    expect(html).toContain(t('approvalsFilterPending'))
    expect(html).toContain(t('approvalsEmptyPending'))
    expect(html).toContain(t('approvalSearchPlaceholder'))
    expect(html).toContain('aria-selected="true"')
  })

  it('renders a pending card collapsed, without the submit action', () => {
    const html = renderToStaticMarkup(
      <Approvals t={t} language="zh" data={handle(snapshot({ approvals: [approval()] }))} />,
    )

    expect(html).toContain('测试审批')
    expect(html).toContain('#7380b6')
    expect(html).toContain(t('approvalRequester'))
    expect(html).not.toContain(t('approvalSubmit'))
    expect(html).toContain('aria-expanded="false"')
  })

  it('shows the connection banner when the last poll failed', () => {
    const html = renderToStaticMarkup(
      <Approvals t={t} language="zh" data={{ error: 'wrong-origin', refresh: () => undefined }} />,
    )

    expect(html).toContain(t('approvalConnectionLost'))
    expect(html).toContain(t('approvalRefresh'))
  })
})

describe('ApprovalCard', () => {
  it('renders options and actions when expanded', () => {
    const html = renderToStaticMarkup(
      <ApprovalCard
        t={t}
        approval={approval()}
        now={NOW}
        language="zh"
        expanded
        busy={false}
        onToggle={() => undefined}
        onSubmit={() => undefined}
      />,
    )

    expect(html).toContain(t('approvalSubmit'))
    expect(html).toContain(t('approvalSkip'))
    expect(html).toContain('批准')
    expect(html).toContain('aria-expanded="true"')
  })

  it('renders a decided card read-only with its decision', () => {
    const html = renderToStaticMarkup(
      <ApprovalCard
        t={t}
        approval={approval({
          decidedAt: NOW,
          decision: { kind: 'selected', index: 0, label: '批准', note: '先灰度', transport: 'inline' },
        })}
        now={NOW}
        language="zh"
        expanded
        busy={false}
        onToggle={() => undefined}
        onSubmit={() => undefined}
      />,
    )

    expect(html).toContain(t('approvalDecidedTitle'))
    expect(html).toContain('先灰度')
    expect(html).not.toContain(t('approvalSubmit'))
    expect(html).toContain('data-readonly')
  })
})

describe('Tickets view', () => {
  it('opens on the queued capsule and explains an empty queue', () => {
    const html = renderToStaticMarkup(<Tickets t={t} language="zh" data={handle(snapshot())} />)

    expect(html).toContain(t('ticketsFilterQueued'))
    expect(html).toContain(t('ticketsEmptyQueued'))
    expect(html).toContain(t('ticketsSearchPlaceholder'))
  })

  it('renders a blocked ticket under the running badge with both sub-tags', () => {
    // 默认胶囊是「待处理」，blocked 落在「进行中」；卡片的徽标与副标签单独验证。
    const html = renderToStaticMarkup(
      <TicketCard
        t={t}
        ticket={ticket({ stage: 'blocked', interrupted: true })}
        now={NOW}
        language="zh"
      />,
    )

    expect(html).toContain(t('ticketStageRunning'))
    expect(html).toContain(t('ticketBlockedTag'))
    expect(html).toContain(t('ticketInterruptedTag'))
    expect(html).toContain('#9c20e7')
  })
})

describe('ConsoleTabStrip', () => {
  it('renders the pending count as a badge', () => {
    const html = renderToStaticMarkup(
      <ConsoleTabStrip
        tabs={[
          { id: 'approvals', label: t('tabApprovals'), badge: 2 },
          { id: 'tickets', label: t('tabTickets') },
        ]}
        active="approvals"
        onSelect={() => undefined}
      />,
    )

    expect(html).toContain('pa-console__badge')
    expect(html).toContain('>2<')
  })

  it('hides the badge when the count is zero', () => {
    const html = renderToStaticMarkup(
      <ConsoleTabStrip
        tabs={[{ id: 'approvals', label: t('tabApprovals'), badge: 0 }]}
        active="approvals"
        onSelect={() => undefined}
      />,
    )

    expect(html).not.toContain('pa-console__badge')
  })
})
