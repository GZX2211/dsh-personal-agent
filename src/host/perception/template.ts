// src/host/perception/template.ts
//
// 声明式模板：来源用一句话陈述事实，Host 把事件字段填进去。
//
// 模板是用户数据（模型写的 statement），所以渲染不能失败：引用了不存在的字段就
// 渲染成空串，让这条事实照样记下来，而不是因为一个笔误丢掉一次感知。

/**
 * 按点路径取值。
 *
 * 只读自有属性：模板是外部输入，不应该借 `__proto__` 之类的路径摸到原型链。
 */
export function readPath(source: unknown, path: string): unknown {
  if (path.length === 0) return source
  let current: unknown = source
  for (const segment of path.split('.')) {
    if (current === null || typeof current !== 'object') return undefined
    if (!Object.hasOwn(current, segment)) return undefined
    current = (current as Record<string, unknown>)[segment]
  }
  return current
}

/**
 * 渲染 `{a.b}` 形式的占位符。
 *
 * 缺失与 null 都渲染为空串；结构化值序列化为 JSON——打印成 `[object Object]`
 * 对读它的人来说没有信息量。
 */
export function renderTemplate(template: string, scope: Record<string, unknown>): string {
  return template.replace(/\{([^{}]+)\}/g, (_match, path: string) => format(readPath(scope, path.trim())))
}

function format(value: unknown): string {
  if (value === undefined || value === null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}
