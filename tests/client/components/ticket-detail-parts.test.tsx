// tests/client/components/ticket-detail-parts.test.tsx
//
// 详情页的非时间线部分：头部只保留核心事实；交付与目录默认折叠，展开后可读。

import { describe, expect, it, vi } from 'vitest'

vi.mock('@deepseek-ai/dsh-client-ui-primitives', async () => await import('../../support/ui-primitives-stub.tsx'))

import { renderToStaticMarkup } from 'react-dom/server'
import type { TicketDetailResponse } from '../../../src/shared/ticket-detail.ts'
import { NO_ACTIONS } from '../../../src/client/actions.ts'
import { DeliveryFold } from '../../../src/client/components/ticket/DeliveryFold.tsx'
import { SessionFold } from '../../../src/client/components/ticket/SessionFold.tsx'
import { TicketDetailHeader } from '../../../src/client/components/ticket/TicketDetailHeader.tsx'
import { translateFor } from '../../../src/client/i18n.ts'
import { TicketDetail } from '../../../src/client/views/TicketDetail.tsx'

const t = translateFor('zh')
const NOW = new Date(2026, 10, 22, 9, 30).getTime()

function detail(overrides: Partial<TicketDetailResponse> = {}): TicketDetailResponse {
  return {
    ticket: {
      id: 't-abcdef1234',
      shortId: 'abcdef',
      title: '修复接口契约',
      stage: 'ended',
      goal: '把契约修好',
      outcome: 'completed',
      createdAt: NOW,
      updatedAt: NOW,
      dispatchedAt: NOW + 1_000,
      endedAt: NOW + 60_000,
      workerSessionId: 'session-worker',
      directory: 'work/t-abcdef1234',
      report: '契约已修复，冒烟测试通过。',
    },
    mode: 'dispatch',
    origin: {},
    lanes: [
      { id: 'router', index: 0, role: 'router', status: 'idle' },
      { id: 'human', index: 1, role: 'human', status: 'idle' },
      {
        id: 'session-worker',
        index: 2,
        role: 'lead',
        status: 'done',
        name: 'lead',
        sessionId: 'session-worker',
        turns: 2,
      },
      {
        id: 'session-reviewer',
        index: 3,
        role: 'subagent',
        status: 'done',
        name: 'reviewer',
        sessionId: 'session-reviewer',
        parentId: 'session-worker',
      },
    ],
    rows: [],
    delivery: { report: '契约已修复，冒烟测试通过。', outcome: 'completed' },
    metrics: {
      agents: 2,
      hops: 1,
      supplements: 0,
      parallel: 0,
      pingPong: 0,
      turns: 2,
      tokens: 6_800,
      durationMs: 60_000,
    },
    completeness: { logs: 'full' },
    generatedAt: NOW + 60_000,
    ...overrides,
  }
}

describe('TicketDetailHeader', () => {
  it('keeps the short id, stage, title, owner and counts', () => {
    const html = renderToStaticMarkup(
      <TicketDetailHeader
        t={t}
        language="zh"
        detail={detail()}
        handoffCount={3}
        ownerName="lead"
        actions={NO_ACTIONS}
        onBack={() => undefined}
      />,
    )

    expect(html).toContain('#abcdef')
    expect(html).toContain('修复接口契约')
    expect(html).toContain('负责人')
    expect(html).toContain('2 个 Agent')
    expect(html).toContain('3 次交接')
    expect(html).toContain('打开会话')
    expect(html).toContain('aria-label="返回工单列表"')
  })

  it('disables opening a session while the ticket is still queued', () => {
    const html = renderToStaticMarkup(
      <TicketDetailHeader
        t={t}
        language="zh"
        detail={detail({ ticket: { ...detail().ticket, stage: 'queued', workerSessionId: undefined } })}
        handoffCount={0}
        ownerName="Worker"
        actions={NO_ACTIONS}
        onBack={() => undefined}
      />,
    )

    expect(html).toContain('排队中')
    expect(html).toContain('disabled=""')
  })
})

describe('DeliveryFold', () => {
  it('shows the report, outcome and metric tiles when open', () => {
    const html = renderToStaticMarkup(
      <DeliveryFold
        t={t}
        language="zh"
        detail={detail()}
        handoffCount={3}
        open
        onToggle={() => undefined}
      />,
    )

    expect(html).toContain('契约已修复，冒烟测试通过。')
    // 状态只在折叠头出现；展开体里不再重复状态行，正文直接就是交接汇报。
    expect(html).not.toContain('状态')
    expect(html).toContain('2')
    expect(html).toContain('3')
    expect(html).toContain('1分钟')
    expect(html).toContain('6800')
  })

  it('stays collapsed by default', () => {
    const html = renderToStaticMarkup(
      <DeliveryFold
        t={t}
        language="zh"
        detail={detail()}
        handoffCount={3}
        open={false}
        onToggle={() => undefined}
      />,
    )

    expect(html).toContain('aria-expanded="false"')
    expect(html).not.toContain('契约已修复，冒烟测试通过。')
  })
})

describe('SessionFold', () => {
  it('lists the owner, subagents, directory and session id when open', () => {
    const html = renderToStaticMarkup(
      <SessionFold t={t} detail={detail()} open onToggle={() => undefined} />,
    )

    expect(html).toContain('lead')
    expect(html).toContain('reviewer')
    expect(html).toContain('work/t-abcdef1234')
    expect(html).toContain('session-worker')
  })

  it('uses a neutral default directory when the ticket has no explicit directory', () => {
    const html = renderToStaticMarkup(
      <SessionFold
        t={t}
        detail={detail({ ticket: { ...detail().ticket, directory: undefined } })}
        open
        onToggle={() => undefined}
      />,
    )

    expect(html).toContain('默认目录')
    expect(html).not.toContain('尚未创建')
  })
})

describe('TicketDetail view', () => {
  it('starts with a loading state and a back-capable shell', () => {
    const html = renderToStaticMarkup(
      <TicketDetail
        ticketId="t-abcdef1234"
        t={t}
        language="zh"
        actions={NO_ACTIONS}
        onBack={() => undefined}
        onMissing={() => undefined}
      />,
    )

    expect(html).toContain('pa-ticket-detail')
    expect(html).toContain('正在读取工单…')
  })
})
