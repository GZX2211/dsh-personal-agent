// src/client/components/HelpPopover.tsx
//
// 过滤条右侧的「?」：点开是一段说明，再点按钮或点面板外收起。
// 浮层自己管开关，页面只负责给文案。

import { useEffect, useRef, useState, type ReactElement } from 'react'
import { IconButton } from './card/IconButton.tsx'

export interface HelpPopoverProps {
  /** 无障碍名（「帮助」）。 */
  label: string
  title: string
  paragraphs: readonly string[]
  closeLabel: string
}

export function HelpPopover({ label, title, paragraphs, closeLabel }: HelpPopoverProps): ReactElement {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const dismiss = (event: PointerEvent): void => {
      if (root.current !== null && !root.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [open])

  return (
    <div className="pa-help" ref={root}>
      <IconButton
        icon="help"
        label={label}
        aria-expanded={open}
        onClick={() => setOpen(current => !current)}
      />
      {open ? (
        <div className="pa-help-pop" role="dialog" aria-label={title}>
          <strong>{title}</strong>
          {paragraphs.map(paragraph => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          <button type="button" className="pa-help-pop__close" onClick={() => setOpen(false)}>
            {closeLabel}
          </button>
        </div>
      ) : null}
    </div>
  )
}
