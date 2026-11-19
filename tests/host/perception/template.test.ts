// tests/host/perception/template.test.ts
//
// 声明式模板：来源用一句话陈述事实，Host 负责把事件里的字段填进去。模板是用户数据，
// 不能因为它引用了不存在的字段就让投递失败——缺失一律渲染成空串。

import { describe, expect, it } from 'vitest'
import { readPath, renderTemplate } from '../../../src/host/perception/template.ts'

describe('readPath', () => {
  it('reads a nested field', () => {
    expect(readPath({ payload: { ticketId: 't-1' } }, 'payload.ticketId')).toBe('t-1')
  })

  it('reads an array element by index', () => {
    expect(readPath({ paths: ['a', 'b'] }, 'paths.1')).toBe('b')
  })

  it('returns undefined for a missing segment', () => {
    expect(readPath({ payload: {} }, 'payload.ticketId')).toBeUndefined()
    expect(readPath({ payload: null }, 'payload.ticketId')).toBeUndefined()
    expect(readPath(undefined, 'payload')).toBeUndefined()
  })

  it('returns the value itself for an empty path', () => {
    const scope = { a: 1 }

    expect(readPath(scope, '')).toBe(scope)
  })

  it('does not walk the prototype chain', () => {
    // 模板是外部输入，不该借路径摸到 Object.prototype。
    expect(readPath({}, '__proto__.constructor')).toBeUndefined()
    expect(readPath({ payload: {} }, 'payload.toString')).toBeUndefined()
  })
})

describe('renderTemplate', () => {
  it('fills every placeholder from the scope', () => {
    const text = renderTemplate('工单 {payload.ticketId} 以 {payload.outcome} 结束', {
      payload: { ticketId: 't-1', outcome: 'completed' },
    })

    expect(text).toBe('工单 t-1 以 completed 结束')
  })

  it('renders a missing field as empty text', () => {
    expect(renderTemplate('a{payload.ghost}b', { payload: {} })).toBe('ab')
  })

  it('renders numbers and booleans', () => {
    expect(renderTemplate('{count}/{ok}', { count: 3, ok: false })).toBe('3/false')
  })

  it('renders a null value as empty text', () => {
    expect(renderTemplate('[{value}]', { value: null })).toBe('[]')
  })

  it('serializes a structured value instead of printing object Object', () => {
    expect(renderTemplate('{payload}', { payload: { a: 1 } })).toBe('{"a":1}')
  })

  it('keeps text without placeholders unchanged', () => {
    expect(renderTemplate('纯文本 { 未闭合', {})).toBe('纯文本 { 未闭合')
  })

  it('renders an empty template as empty text', () => {
    expect(renderTemplate('', { a: 1 })).toBe('')
  })

  it('ignores whitespace inside a placeholder', () => {
    expect(renderTemplate('{ payload.ticketId }', { payload: { ticketId: 't-1' } })).toBe('t-1')
  })
})
