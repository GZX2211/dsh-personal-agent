// src/client/lib/files.ts
//
// 文件地址：宿主右侧栏只认 `dsh-resource://file/…` 地址（语法见官方
// util/workspace-path）。这里只做「会话 + 绝对路径 → 地址」和「路径 → 可读名」，
// 不碰文件系统，也不拼相对地址——相对路径在 Host 侧已归一成绝对路径。
//
// 必须带会话：文档预览只认 `session/<sessionId>/<path>`，无会话的 `absolute/`
// 地址没有读取授权，不会被任何预览类型认领。

const FILE_ADDRESS_PREFIX = 'dsh-resource://file/'

/** 组件编码一个 id 或路径段；盘符的 `:` 保持字面。 */
function encodeSegment(segment: string): string {
  return encodeURIComponent(segment).replace(/%3A/gi, ':')
}

/** 按 `/` 分段编码路径。 */
function encodePath(path: string): string {
  return path.split('/').map(encodeSegment).join('/')
}

/**
 * 某个会话下的文件资源地址。
 *
 * 反斜杠归一成 `/`，去掉前导 `./`；绝对路径（含盘符与 UNC）原样保留在会话地址里，
 * Host 用该会话的读取授权解析它。这样右侧栏的文档预览才能认领并打开。
 */
export function sessionFileAddress(sessionId: string, path: string): string {
  const normalized = path.replace(/\\/g, '/').replace(/^(?:\.\/)+/, '')
  return `${FILE_ADDRESS_PREFIX}session/${encodeSegment(sessionId)}/${encodePath(normalized)}`
}

/** 展示名：路径最后一段；尾随分隔符不算一段。 */
export function fileName(path: string): string {
  const segments = path
    .replace(/\\/g, '/')
    .split('/')
    .filter(segment => segment.length > 0)
  return segments[segments.length - 1] ?? path
}
