// src/client/lib/files.ts
//
// 文件地址：宿主右侧栏只认 `dsh-resource://file/…` 地址（语法见官方
// util/workspace-path）。这里只做「绝对路径 → 地址」和「路径 → 可读名」，
// 不碰文件系统，也不拼相对地址——相对路径在 Host 侧已归一成绝对路径。

const FILE_ADDRESS_PREFIX = 'dsh-resource://file/'

/**
 * 绝对路径的 file 资源地址。
 *
 * 反斜杠归一成 `/`，去掉前导斜杠（UNC 的 `//` 保留一个空段），逐段做组件编码；
 * 盘符的 `:` 保持字面，读起来与资源管理器一致。
 */
export function absoluteFileAddress(path: string): string {
  const normalized = path.replace(/\\/g, '/')
  const unc = normalized.startsWith('//')
  const bare = normalized.replace(/^\/+/, '')
  const encoded = bare
    .split('/')
    .map(segment => encodeURIComponent(segment).replace(/%3A/gi, ':'))
    .join('/')
  return `${FILE_ADDRESS_PREFIX}absolute/${unc ? '/' : ''}${encoded}`
}

/** 展示名：路径最后一段；尾随分隔符不算一段。 */
export function fileName(path: string): string {
  const segments = path
    .replace(/\\/g, '/')
    .split('/')
    .filter(segment => segment.length > 0)
  return segments[segments.length - 1] ?? path
}
