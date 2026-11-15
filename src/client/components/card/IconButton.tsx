// src/client/components/card/IconButton.tsx
//
// 官方卡片里的 24×24 圆形图标按钮：一个尺寸、一套 hover，供折叠、分页共用。

import type { ButtonHTMLAttributes, ReactElement } from 'react'
import { Icon, type IconName } from './Icon.tsx'

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'> {
  icon: IconName
  /** 必填：图标按钮没有可见文字，无障碍名只能来自这里。 */
  label: string
}

export function IconButton({ icon, label, type = 'button', ...rest }: IconButtonProps): ReactElement {
  return (
    <button type={type} className="pa-icon-button" aria-label={label} title={label} {...rest}>
      <Icon name={icon} size={14} />
    </button>
  )
}
