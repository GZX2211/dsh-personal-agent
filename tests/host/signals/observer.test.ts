// tests/host/signals/observer.test.ts
//
// router 观察者把 L1 的 inbox 事实提升为 L2 的信号事实：消息进入 inbox 就记账，
// 回合结束把没被认领的信号结算为响应。它只认 router 会话，也只认白名单里的输入。

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { UserMessage } from '@deepseek-ai/dsh-llm'
import type { SessionEvent } from '@deepseek-ai/dsh-session'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createClaimRegistry, type ClaimRegistry } from '../../../src/host/signals/claim.ts'
import { registerRouterSignalObserver } from '../../../src/host/signals/observer.ts'
import { EventStore } from '../../../src/host/store/event-store.ts'
import { createFakeHost, type FakeHost } from '../../support/fake-host.ts'

const ROUTER_SESSION = 'session-router'
const OTHER_SESSION = 'session-worker'

let directory: string
let store: EventStore
let host: FakeHost
let claims: ClaimRegistry
let logs: string[]
let routerSessionId: string | undefined
let disposeObserver: () => void

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'pa-signal-observer-'))
  store = await EventStore.open({ directory })
  host = createFakeHost({ liveSessionIds: [ROUTER_SESSION, OTHER_SESSION] })
  claims = createClaimRegistry()
  logs = []
  routerSessionId = ROUTER_SESSION
  disposeObserver = registerRouterSignalObserver({
    ctx: host.ctx,
    store,
    claims,
    currentRouterSessionId: () => routerSessionId,
    now: () => 1_700_000_000_000,
    log: message => logs.push(message),
  })
})

afterEach(async () => {
  disposeObserver()
  store.close()
  await rm(directory, { recursive: true, force: true })
})

function userMessage(text: string, id = 'msg-1'): UserMessage {
  return {
    id,
    role: 'user',
    content: [{ type: 'text', text }],
    source: { kind: 'user' },
  } as unknown as UserMessage
}

function sourcedMessage(text: string, source: unknown, id = 'msg-1'): UserMessage {
  return { id, role: 'user', content: [{ type: 'text', text }], source } as unknown as UserMessage
}

function spliced(inserted: UserMessage[], extra: Record<string, unknown> = {}): SessionEvent {
  return {
    type: 'agent/inbox/spliced',
    seq: 1,
    time: 0,
    data: { target: 'next-turn', start: 0, inserted, ...extra },
  } as unknown as SessionEvent
}

type TurnEndKind = 'completed' | 'aborted' | 'error'

function turnEnd(turn: number, kind: TurnEndKind): SessionEvent {
  const reasons: Record<TurnEndKind, unknown> = {
    completed: { kind: 'completed' },
    aborted: { kind: 'aborted', reason: { kind: 'user' } },
    error: { kind: 'error', error: { message: 'boom', code: 'UNKNOWN' } },
  }
  return { type: 'turn/end', seq: 2, time: 1, data: { turn, reason: reasons[kind] } } as unknown as SessionEvent
}

function claimMessage(message: UserMessage, turn: number): void {
  const agent = host.sessions.get(ROUTER_SESSION)?.agent
  if (agent === undefined) throw new Error('fake host has no router session')
  host.emitEvent('agent/inbox/claimed', { agent, message, turn })
}

function signals() {
  return store.projection().signals
}

function decisions(): string[] {
  return store.events().flatMap(event =>
    event.type === 'decision/recorded' ? [`${event.payload.signalId}:${event.payload.action}`] : [],
  )
}

describe('router signal observer', () => {
  it('records a user message as a delivered signal', () => {
    host.emitSessionEvent(ROUTER_SESSION, spliced([userMessage('帮我把 README 改一下')]))

    expect(signals()).toEqual([
      expect.objectContaining({
        kind: 'user-message',
        delivered: true,
        text: '帮我把 README 改一下',
        receivedAt: 1_700_000_000_000,
        messageId: 'msg-1',
      }),
    ])
    expect(signals()[0]?.signalId).toMatch(/^s-[0-9a-f]{10}$/)
    expect(signals()[0]).not.toHaveProperty('decision')
  })

  it('correlates the signal with the message it came from', () => {
    host.emitSessionEvent(ROUTER_SESSION, spliced([userMessage('你好')]))

    const signal = store.events().find(event => event.type === 'signal/received')
    expect(signal?.sessionId).toBe(ROUTER_SESSION)
    expect(signal?.correlationId).toBe(signals()[0]?.signalId)
  })

  it('ignores messages of other sessions', () => {
    host.emitSessionEvent(OTHER_SESSION, spliced([userMessage('worker 自己的输入')]))

    expect(signals()).toEqual([])
  })

  it('records nothing while the router identity is still unknown', () => {
    routerSessionId = undefined

    host.emitSessionEvent(ROUTER_SESSION, spliced([userMessage('过早到达的消息')]))

    expect(signals()).toEqual([])
    expect(logs).toEqual([])
  })

  it('records every message of one splice in arrival order', () => {
    host.emitSessionEvent(
      ROUTER_SESSION,
      spliced([userMessage('第一条', 'msg-1'), userMessage('第二条', 'msg-2')]),
    )

    const recorded = store.events().flatMap(event =>
      event.type === 'signal/received' ? [event.payload.messageId] : [],
    )
    expect(recorded).toEqual(['msg-1', 'msg-2'])
  })

  it('records a message inserted before the next step', () => {
    host.emitSessionEvent(
      ROUTER_SESSION,
      spliced([userMessage('插到下一步')], { target: 'next-step' }),
    )

    expect(signals()).toHaveLength(1)
  })

  it('ignores removals and cancellations', () => {
    host.emitSessionEvent(ROUTER_SESSION, spliced([], { removedCount: 2 }))
    host.emitSessionEvent(ROUTER_SESSION, spliced([userMessage('被取消的消息')], { outcome: 'canceled' }))

    expect(signals()).toEqual([])
  })

  it('ignores every source outside the whitelist', () => {
    host.emitSessionEvent(
      ROUTER_SESSION,
      spliced([sourcedMessage('背景注入', { kind: 'agent-instructions' }, 'msg-a')]),
    )

    expect(signals()).toEqual([])
  })

  it('records a schedule reminder as a timer signal', () => {
    const text = [
      '[SCHEDULE REMINDER]',
      'This is a scheduled message from the user',
      'schedule_id_json: "schedule-06148949"',
      'occurrence_at: 2026-09-29T02:42:51.334Z',
      'reminder_prompt_json: "提醒我喝水"',
    ].join('\n')

    host.emitSessionEvent(ROUTER_SESSION, spliced([sourcedMessage(text, { kind: 'schedule' })]))

    expect(signals()[0]).toEqual(
      expect.objectContaining({
        kind: 'timer',
        sourceId: 'schedule-06148949',
        text: '提醒我喝水',
      }),
    )
  })

  it('records a perception notice with its source coordinates', () => {
    const text = ['[感知事件]', '事实：文件被修改', '信号：s-0123456789'].join('\n')

    host.emitSessionEvent(
      ROUTER_SESSION,
      spliced([
        sourcedMessage(text, {
          kind: 'dsh-personal-agent/perception',
          sourceId: 'src-1',
          threadId: 'th-1',
          sourceName: '本地文件',
          threadName: 'watchme',
        }),
      ]),
    )

    expect(signals()[0]).toEqual(
      expect.objectContaining({
        kind: 'perception',
        sourceId: 'src-1',
        threadId: 'th-1',
        sourceName: '本地文件',
        threadName: 'watchme',
        text: '文件被修改',
      }),
    )
  })

  it('records each message once even when the splice is observed twice', () => {
    const message = userMessage('重复观察')
    host.emitSessionEvent(ROUTER_SESSION, spliced([message]))
    host.emitSessionEvent(ROUTER_SESSION, spliced([message]))

    expect(signals()).toHaveLength(1)
  })

  it('settles an unclaimed signal as a reply when the turn ends', () => {
    const message = userMessage('今天辛苦了')
    host.emitSessionEvent(ROUTER_SESSION, spliced([message]))
    claimMessage(message, 1)

    host.emitSessionEvent(ROUTER_SESSION, turnEnd(1, 'completed'))

    expect(signals()[0]?.decision).toMatchObject({ action: 'reply', inferred: true })
    expect(signals()[0]?.decision).not.toHaveProperty('ticketId')
  })

  it('records why an abnormal turn settled as a reply', () => {
    const message = userMessage('帮我把 README 改一下')
    host.emitSessionEvent(ROUTER_SESSION, spliced([message]))
    claimMessage(message, 1)

    host.emitSessionEvent(ROUTER_SESSION, turnEnd(1, 'aborted'))

    expect(signals()[0]?.decision).toMatchObject({ action: 'reply', inferred: true })
    const decision = store.events().find(event => event.type === 'decision/recorded')
    expect(decision?.payload).toMatchObject({ reason: 'aborted' })
  })

  it('settles a turn that ended in error without losing the input', () => {
    const message = userMessage('模型报错了')
    host.emitSessionEvent(ROUTER_SESSION, spliced([message]))
    claimMessage(message, 1)

    host.emitSessionEvent(ROUTER_SESSION, turnEnd(1, 'error'))

    expect(decisions()).toHaveLength(1)
    expect(signals()[0]?.decision).toMatchObject({ action: 'reply', inferred: true })
    const decision = store.events().find(event => event.type === 'decision/recorded')
    expect(decision?.payload).toMatchObject({ reason: 'error' })
  })

  it('leaves a signal pending when its message never entered a turn', () => {
    host.emitSessionEvent(ROUTER_SESSION, spliced([userMessage('还在排队')]))

    host.emitSessionEvent(ROUTER_SESSION, turnEnd(1, 'completed'))

    expect(signals()[0]).not.toHaveProperty('decision')
    expect(decisions()).toEqual([])
  })

  it('settles only the signals of the turn that ended', () => {
    const first = userMessage('第一条', 'msg-1')
    const second = userMessage('第二条', 'msg-2')
    host.emitSessionEvent(ROUTER_SESSION, spliced([first]))
    host.emitSessionEvent(ROUTER_SESSION, spliced([second]))
    claimMessage(first, 1)
    claimMessage(second, 2)

    host.emitSessionEvent(ROUTER_SESSION, turnEnd(1, 'completed'))

    const settled = signals().filter(signal => signal.decision !== undefined)
    expect(settled).toHaveLength(1)
    expect(settled[0]?.text).toBe('第一条')
  })

  it('logs a failure instead of breaking the session write', () => {
    disposeObserver()
    const failing = registerRouterSignalObserver({
      ctx: host.ctx,
      store,
      claims,
      currentRouterSessionId: () => ROUTER_SESSION,
      log: message => logs.push(message),
    })
    store.close()

    host.emitSessionEvent(ROUTER_SESSION, spliced([userMessage('写入会失败')]))

    expect(logs.some(message => message.includes('signal observation failed'))).toBe(true)
    disposeObserver = failing
  })
})
