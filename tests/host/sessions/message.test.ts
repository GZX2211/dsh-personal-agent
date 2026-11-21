// tests/host/sessions/message.test.ts
//
// 投递消息的身份：消息 id 由 requestId 派生（这是投递幂等的依据），source 声明本插件
// 是生产者，并带上它属于哪张工单——账本之外也要能反查一条消息为什么出现。

import { describe, expect, it } from 'vitest'
import {
  createDeliveryMessage,
  deliveryMessageId,
  createPerceptionMessage,
} from '../../../src/host/sessions/message.ts'

describe('deliveryMessageId', () => {
  it('derives one message id from one request id', () => {
    expect(deliveryMessageId('r-1')).toBe('pa-delivery:r-1')
  })
})

describe('createDeliveryMessage', () => {
  it('declares this plugin as the producer', () => {
    const message = createDeliveryMessage('r-1', '任务简报')

    expect(message.id).toBe('pa-delivery:r-1')
    expect(message.role).toBe('user')
    expect(message.content).toEqual([{ type: 'text', text: '任务简报' }])
    expect(message.source).toEqual({ kind: 'dsh-personal-agent', form: 'relay' })
  })

  it('carries the ticket a brief belongs to', () => {
    const message = createDeliveryMessage('r-1', '任务简报', { ticketId: 't-1' })

    expect(message.source).toEqual({ kind: 'dsh-personal-agent', form: 'relay', ticketId: 't-1' })
  })

  it('carries the idempotency key of a supplement message', () => {
    const message = createDeliveryMessage('pa-supplement:t-1:abc', '契约改了', {
      ticketId: 't-1',
      supplementId: 'pa-supplement:t-1:abc',
    })

    expect(message.source).toEqual({
      kind: 'dsh-personal-agent',
      form: 'relay',
      ticketId: 't-1',
      supplementId: 'pa-supplement:t-1:abc',
    })
  })

  it('freezes the message it returns', () => {
    const message = createDeliveryMessage('r-1', '任务简报')

    expect(Object.isFrozen(message)).toBe(true)
    expect(Object.isFrozen(message.source)).toBe(true)
  })
})

describe('createPerceptionMessage', () => {
  it('keeps the source coordinates of a perception fact', () => {
    const message = createPerceptionMessage({
      sourceId: 'src-1',
      sourceName: '配置文件',
      threadId: 'th-1',
      threadName: '变更',
      externalId: 'e-1',
      statement: 'app.yml 被修改',
      signalId: 's-1',
      at: 1_700_000_000_000,
    })

    expect(message.content[0]).toEqual({
      type: 'text',
      text: expect.stringContaining('app.yml 被修改'),
    })
    expect(message.source).toEqual({
      kind: 'dsh-personal-agent/perception',
      form: 'notice',
      sourceId: 'src-1',
      threadId: 'th-1',
      sourceName: '配置文件',
      threadName: '变更',
    })
  })
})
