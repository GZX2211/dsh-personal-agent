// src/host/perception/fs-pattern.ts
//
// ignore 模式的自实现 glob。
//
// 引入一个 glob 依赖只为几行匹配并不划算，而语义又必须是确定的：`**` 跨目录、
// `*` 与 `?` 不跨分隔符、`/` 与 `\` 等价（Windows 路径两种写法都出现）。

/** 默认忽略：依赖目录、版本库、临时文件与 Office 锁文件。 */
export const DEFAULT_IGNORES: readonly string[] = [
  '**/node_modules/**',
  '**/.git/**',
  '**/*.tmp',
  '**/~$*',
]

/** 把 glob 编译成整串锚定的正则。 */
export function globToRegExp(pattern: string): RegExp {
  const normalized = pattern.replaceAll('\\', '/')
  let source = '^'
  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index] as string
    if (char === '*') {
      if (normalized[index + 1] === '*') {
        index += 1
        // `**/` 也要吃掉那层分隔符：`**/a` 应当匹配 `a` 本身。
        if (normalized[index + 1] === '/') {
          index += 1
          source += '(?:.*/)?'
        } else {
          source += '.*'
        }
        continue
      }
      source += '[^/]*'
      continue
    }
    if (char === '?') {
      source += '[^/]'
      continue
    }
    source += char.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&')
  }
  source += '$'
  return new RegExp(source)
}

/** 路径是否命中任意一个忽略模式。 */
export function isIgnored(path: string, patterns: readonly string[]): boolean {
  const normalized = path.replaceAll('\\', '/')
  return patterns.some(pattern => globToRegExp(pattern).test(normalized))
}
