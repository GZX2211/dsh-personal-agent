// src/client/components/ticket/tone.ts
//
// 链语义色 → 官方 Tag 色调。映射放在组件层：TagTone 来自官方 UI 包，
// lib 不得依赖任何 UI 模块。

import type { TagTone } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ChainTone } from '../../lib/chain.ts'

export function toneTagTone(tone: ChainTone): TagTone {
  switch (tone) {
    case 'neutral':
      return 'neutral'
    case 'info':
      return 'info'
    case 'success':
      return 'success'
    case 'warning':
      return 'warning'
    case 'danger':
      return 'danger'
  }
}
