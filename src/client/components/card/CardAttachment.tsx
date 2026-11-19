// src/client/components/card/CardAttachment.tsx
//
// 附件行：worker 随审批带上的文件，人只读。没有附件时整行不渲染
// （「未填不显示该项」），所以这里不处理空列表文案。

import { IconPaperclipOutlineRegular, PathLabel } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ReactElement } from 'react'

export interface CardAttachmentProps {
  paths: readonly string[]
  label: string
  openHint: string
  onOpen?: (path: string) => void
}

export function CardAttachment({ paths, label, openHint, onOpen }: CardAttachmentProps): ReactElement | null {
  if (paths.length === 0) return null
  return (
    <div className="pa-detail__attachments">
      <span className="pa-detail__attachment-seat" aria-hidden="true">
        <IconPaperclipOutlineRegular />
      </span>
      <span className="pa-detail__attachment-copy">
        <span className="pa-detail__attachment-label">
          {label}
          {'\uFF1A'}
        </span>
        {paths.map(path => (
          <button
            key={path}
            type="button"
            className="pa-detail__attachment-file"
            title={path}
            onClick={() => onOpen?.(path)}
          >
            <PathLabel path={path} />
          </button>
        ))}
        <span className="pa-detail__attachment-hint">
          {'\uFF08'}
          {openHint}
          {'\uFF09'}
        </span>
      </span>
    </div>
  )
}
