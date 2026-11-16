// src/client/components/card/Icon.tsx
//
// 卡片与过滤条用到的一组 16px 线性图标。宿主没有把图标包暴露给插件，
// 所以按官方图标的同一网格（16×16、1.5px 描边、圆头）自绘，尺寸与描边
// 由 CSS 之外的因素决定，避免不同卡片里粗细不一。

import type { ReactElement, SVGProps } from 'react'

export type IconName =
  | 'chevronDown'
  | 'chevronUp'
  | 'chevronLeft'
  | 'chevronRight'
  | 'edit'
  | 'paperclip'
  | 'search'
  | 'help'

export interface IconProps {
  name: IconName
  size?: number
}

const PATHS: Record<Exclude<IconName, 'help'>, ReactElement> = {
  chevronDown: <path d="M4 6.2 8 10.2 12 6.2" />,
  chevronUp: <path d="M4 9.8 8 5.8 12 9.8" />,
  chevronLeft: <path d="M9.8 4 5.8 8 9.8 12" />,
  chevronRight: <path d="M6.2 4 10.2 8 6.2 12" />,
  edit: <path d="M3 13h10M11 2.6 13.4 5 6.6 11.8 3.8 12.4 4.4 9.6z" />,
  paperclip: (
    <path d="M9.6 3.9 5.1 8.4a2.2 2.2 0 0 0 3.1 3.1L12.7 7a3.4 3.4 0 0 0-4.8-4.8L3.7 6.4a4.5 4.5 0 0 0 6.4 6.4l3.3-3.3" />
  ),
  search: (
    <>
      <circle cx="7" cy="7" r="4" />
      <path d="M10.1 10.1 13.6 13.6" />
    </>
  ),
}

export function Icon({ name, size = 16 }: IconProps): ReactElement {
  const stroke: SVGProps<SVGSVGElement> = {
    width: size,
    height: size,
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
    focusable: false,
  }
  if (name === 'help') {
    return (
      <svg {...stroke}>
        <circle cx="8" cy="8" r="6" />
        <path d="M6.3 6.3a1.8 1.8 0 1 1 2.7 1.6c-.5.3-.9.7-.9 1.3v.3" />
        <circle cx="8" cy="11.6" r="0.7" fill="currentColor" stroke="none" />
      </svg>
    )
  }
  return <svg {...stroke}>{PATHS[name]}</svg>
}
