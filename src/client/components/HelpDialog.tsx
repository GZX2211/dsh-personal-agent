// src/client/components/HelpDialog.tsx
//
// 过滤条右侧的「?」：官方 Button 触发官方 Modal，文案由页面提供。

import { Button, IconQuestionOutlineRegular, Modal, Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import { useState, type ReactElement } from 'react'

export interface HelpDialogProps {
  /** 无障碍名（「帮助」）。 */
  label: string
  title: string
  paragraphs: readonly string[]
  closeLabel: string
}

export function HelpDialog({ label, title, paragraphs, closeLabel }: HelpDialogProps): ReactElement {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Tooltip label={label} side="left">
        <Button
          className="pa-toolbar__help"
          variant="ghost"
          size="sm"
          icon={<IconQuestionOutlineRegular />}
          aria-label={label}
          onClick={() => setOpen(true)}
        />
      </Tooltip>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        closeLabel={closeLabel}
        className="pa-help-dialog"
        footer={
          <Button variant="primary" size="sm" onClick={() => setOpen(false)}>
            {closeLabel}
          </Button>
        }
      >
        {paragraphs.map(paragraph => (
          <p key={paragraph} className="pa-help-text">
            {paragraph}
          </p>
        ))}
      </Modal>
    </>
  )
}
