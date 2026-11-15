// src/client/components/card/Button.tsx
//
// 卡片页脚的两个按钮：`outline`（跳过）与 `primary`（提交）。
// 视觉取宿主按钮的同一套：32px 高、8px 圆角、primary 用前景色填充。

import type { ButtonHTMLAttributes, ReactElement } from 'react'

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'> {
  variant: 'outline' | 'primary'
  children: string
}

export function Button({ variant, children, type = 'button', ...rest }: ButtonProps): ReactElement {
  return (
    <button type={type} className={`pa-button pa-button--${variant}`} {...rest}>
      {children}
    </button>
  )
}
