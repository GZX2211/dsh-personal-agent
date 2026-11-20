// src/host/prompts/index.ts
//
// 提示词是随包分发的文本资源（`prompts/*.md`），不内联进代码：这样改提示词
// 是一次可 review、可 diff 的文件变更，后续做覆盖层与版本记录时也有稳定基线。
// 加载器从当前模块向上找包根，因此源码运行与 lib/ 产物运行走同一条路径。

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { PromptTexts } from '../../shared/settings.ts'

/** 本包在 manifests 里的名字，用于定位包根。 */
const PACKAGE_NAME = 'dsh-personal-agent'

/** 随包分发的提示词文件（不含扩展名）。 */
export type PromptName = 'shared' | 'router' | 'worker'

const cache = new Map<PromptName, string>()

/**
 * 把「一句一行」的 Markdown 拼回段落。
 *
 * 中文句子之间不插空格，拉丁句子之间插一个空格；空行保留为段落分隔。
 */
export function joinPromptMarkdown(text: string): string {
  const paragraphs = text
    .replaceAll('\r\n', '\n')
    .replaceAll('\r', '\n')
    .trim()
    .split(/\n[ \t]*\n+/)

  return paragraphs
    .map(paragraph => {
      const lines = paragraph.split('\n').map(line => line.trim())
      let joined = ''
      for (const line of lines) {
        if (line.length === 0) continue
        // 上一行以 ASCII 结尾时补空格，避免英文句子粘在一起；中文不需要。
        if (joined.length > 0 && /[\x20-\x7e]$/.test(joined)) joined += ' '
        joined += line
      }
      return joined
    })
    .filter(paragraph => paragraph.length > 0)
    .join('\n\n')
}

/** 读一份提示词；缺失或为空都直接失败，因为半套提示词比没有更难排查。 */
export function loadPrompt(name: PromptName): string {
  const cached = cache.get(name)
  if (cached !== undefined) return cached

  const path = join(packageRoot(), 'prompts', `${name}.md`)
  let raw: string
  try {
    raw = readFileSync(path, 'utf8')
  } catch (error) {
    throw new Error(`personal-agent: missing prompt file ${path}`, { cause: error })
  }
  const text = joinPromptMarkdown(raw)
  if (text.length === 0) throw new Error(`personal-agent: empty prompt file ${path}`)
  cache.set(name, text)
  return text
}

/** 三份内置提示词；设置存储以它作为提示词版本 0 的基线。 */
export function defaultPromptTexts(): PromptTexts {
  return {
    shared: loadPrompt('shared'),
    router: loadPrompt('router'),
    worker: loadPrompt('worker'),
  }
}

let cachedSkillBody: string | undefined

/**
 * 读随包分发的技能正文。
 *
 * 与提示词不同，技能正文要保留 Markdown 结构（列表、表格、代码块）：它是给人读的
 * 操作手册，段落拼装会把代码块和表格压成一段。
 */
export function loadSkillBody(): string {
  if (cachedSkillBody !== undefined) return cachedSkillBody

  const path = join(packageRoot(), 'prompts', 'perception-skill.md')
  let raw: string
  try {
    raw = readFileSync(path, 'utf8')
  } catch (error) {
    throw new Error(`personal-agent: missing skill file ${path}`, { cause: error })
  }
  const text = raw.replaceAll('\r\n', '\n').trim()
  if (text.length === 0) throw new Error(`personal-agent: empty skill file ${path}`)
  cachedSkillBody = text
  return text
}

let cachedRoot: string | undefined

/** 从模块位置向上找包根：兼容源码运行（src/…）与打包运行（lib/index.js）。 */
function packageRoot(): string {
  if (cachedRoot !== undefined) return cachedRoot
  let directory = dirname(fileURLToPath(import.meta.url))
  for (let depth = 0; depth < 6; depth += 1) {
    const manifest = join(directory, 'package.json')
    if (existsSync(manifest)) {
      try {
        const parsed = JSON.parse(readFileSync(manifest, 'utf8')) as { name?: unknown }
        if (parsed.name === PACKAGE_NAME) {
          cachedRoot = directory
          return directory
        }
      } catch {
        // 读不动的 manifest 不是包根，继续向上找。
      }
    }
    directory = dirname(directory)
  }
  throw new Error(`personal-agent: cannot locate ${PACKAGE_NAME} package root from ${import.meta.url}`)
}
