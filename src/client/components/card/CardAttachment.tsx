// src/client/components/card/CardAttachment.tsx
//
// 附件行：worker 随审批带上的文件，人只读。没有附件时整行不渲染
// （「未填不显示该项」），所以这里不处理空列表文案。

import type { ReactElement } from 'react'
import { fileName } from '../../lib/files.ts'
import { Icon } from './Icon.tsx'

export interface CardAttachmentProps {
  paths: readonly string[]
  label: string
  openHint: string
  onOpen?: (path: string) => void
}

export function CardAttachment({ paths, label, openHint, onOpen }: CardAttachmentProps): ReactElement | null {
  if (paths.length === 0) return null
  return (
    <div className="pa-card__attachment-row">
      <span className="pa-card__seat" aria-hidden="true">
        <Icon name="paperclip" size={12} />
      </span>
      <span className="pa-card__attachment-copy">
        <span className="pa-card__attachment-label">
          {label}
          {'\uFF1A'}
        </span>
        {paths.map(path => (
          <button
            key={path}
            type="button"
            className="pa-card__attachment-file"
            title={path}
            onClick={() => onOpen?.(path)}
          >
            {fileName(path)}
          </button>
        ))}
        <span className="pa-card__attachment-hint">
          {'\uFF08'}
          {openHint}
          {'\uFF09'}
        </span>
      </span>
    </div>
  )
}
