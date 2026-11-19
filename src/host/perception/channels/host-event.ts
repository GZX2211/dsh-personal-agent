// src/host/perception/channels/host-event.ts
//
// host-event：把账本里发生的事变成感知候选。
//
// 它只看账本写入，不读任何外部系统；订阅范围由来源定义里的 `subscriptions` 决定。
// 描述感知自身活动的事件（信号与来源变更）永远排除在外——否则一次感知会触发下一次
// 感知，来源自己把自己吵醒。

import type { L2Event } from '../../../shared/events.ts'
import type { HostEventChannel, HostEventSubscription } from '../../../shared/sources.ts'
import { renderTemplate } from '../template.ts'
import type { Candidate, ChannelContext, ChannelRuntime } from '../types.ts'

/** 感知自身产生的事实：订阅它们等于让自己感知自己。 */
const SELF_EVENTS = new Set(['signal/received'])
const SELF_EVENT_PREFIXES = ['source/']

export interface HostEventChannelDependencies {
  /** 订阅账本写入；缺省时该渠道只能空转并告警。 */
  subscribeLedger?: (listener: (event: L2Event) => void) => () => void
}

export function createHostEventChannel(
  context: ChannelContext,
  dependencies: HostEventChannelDependencies,
): ChannelRuntime {
  return {
    start() {
      const channel = requireChannel(context.channel)
      if (dependencies.subscribeLedger === undefined) {
        context.warn('账本订阅不可用，host-event 来源无法工作')
        return () => undefined
      }

      const subscribed = groupByEvent(channel.subscriptions)
      return dependencies.subscribeLedger(event => {
        if (isSelfEvent(event.type)) return
        const matching = subscribed.get(event.type)
        if (matching === undefined) return
        for (const subscription of matching) {
          context.emit(toCandidate(subscription, event))
        }
      })
    },
  }
}

function requireChannel(channel: ChannelContext['channel']): HostEventChannel {
  if (channel.kind !== 'host-event') throw new Error('host-event Channel 的配置不匹配')
  return channel
}

function groupByEvent(subscriptions: readonly HostEventSubscription[]): Map<string, HostEventSubscription[]> {
  const grouped = new Map<string, HostEventSubscription[]>()
  for (const subscription of subscriptions) {
    const list = grouped.get(subscription.event) ?? []
    list.push(subscription)
    grouped.set(subscription.event, list)
  }
  return grouped
}

function isSelfEvent(type: string): boolean {
  return SELF_EVENTS.has(type) || SELF_EVENT_PREFIXES.some(prefix => type.startsWith(prefix))
}

/**
 * 事件信封就是陈述模板与匹配表达式的取值域：`{payload.ticketId}`、`{type}` 都直接可用。
 *
 * `externalId` 用事件自身的 id —— 账本已经保证它唯一，去重因此天然成立。
 */
function toCandidate(subscription: HostEventSubscription, event: L2Event): Candidate {
  const scope = {
    type: event.type,
    time: event.time,
    actor: event.actor,
    sessionId: event.sessionId,
    correlationId: event.correlationId,
    payload: event.payload,
  } as Record<string, unknown>

  const candidate: Candidate = {
    thread: subscription.thread,
    statement: renderTemplate(subscription.statement, scope),
    externalId: event.eventId,
    at: event.time,
    // 每个事件自身就是一个状态：edge 模式下不会把连续事件误判成「没变化」。
    state: event.eventId,
    facts: scope,
  }
  return candidate
}
