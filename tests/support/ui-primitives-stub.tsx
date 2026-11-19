// tests/support/ui-primitives-stub.tsx
//
// 官方 UI 原子包在 Node 下会导入 `.module.css` 并依赖 ResizeObserver / portal，
// 因此组件测试用这个替身隔离边界：替身只保留本插件依赖的结构与无障碍语义。
// 官方控件的真实 props 契约仍由 `tsc` 针对真实类型声明检查。

import type { InputHTMLAttributes, ReactElement, ReactNode } from 'react'

interface ChildrenProps {
  children?: ReactNode
}

interface PrimitiveProps extends ChildrenProps {
  className?: string
  /** 官方 Button 的视觉变体。 */
  variant?: string
  size?: string
  icon?: ReactNode
  active?: boolean
  tone?: string
  state?: string
  path?: string
  open?: boolean
  title?: string
  closeLabel?: string
  footer?: ReactNode
  role?: string
  label?: string
  [key: string]: unknown
}

export function Button({ variant, size, icon, children, ...rest }: PrimitiveProps): ReactElement {
  return (
    <button type="button" data-primitive="button" data-variant={variant} data-size={size} {...rest}>
      {icon}
      {children}
    </button>
  )
}

export function Input({ icon, className, ...rest }: { icon?: ReactNode; className?: string } & InputHTMLAttributes<HTMLInputElement>): ReactElement {
  return (
    <span className={className} data-primitive="input">
      {icon}
      <input {...rest} />
    </span>
  )
}

export function Pill({ active, className, children, ...rest }: PrimitiveProps): ReactElement {
  return (
    <button type="button" className={className} data-primitive="pill" data-active={active ? 'true' : undefined} {...rest}>
      {children}
    </button>
  )
}

export function Tag({ tone = 'outline', className, children }: PrimitiveProps): ReactElement {
  return (
    <span className={className} data-primitive="tag" data-tone={tone}>
      {children}
    </span>
  )
}

export function StateDot({ state }: PrimitiveProps): ReactElement {
  return <span data-primitive="state-dot" data-state={state} />
}

export function PathLabel({ path, className }: PrimitiveProps): ReactElement {
  return (
    <span className={className} data-primitive="path-label" title={path}>
      {path}
    </span>
  )
}

export function Modal({ open, title, closeLabel, children, footer }: PrimitiveProps): ReactElement | null {
  if (open !== true) return null
  return (
    <div role="dialog" aria-label={title} data-primitive="modal">
      <button type="button" aria-label={closeLabel} />
      <div>{children}</div>
      {footer}
    </div>
  )
}

export function Tooltip({ children }: PrimitiveProps): ReactNode {
  return children
}

export function AnimatedRows({ className, role, label, children }: PrimitiveProps): ReactElement {
  return (
    <div className={className} role={role} aria-label={label} data-primitive="animated-rows">
      {children}
    </div>
  )
}

function glyph(name: string): () => ReactElement {
  return function Icon(): ReactElement {
    return <svg data-icon={name} aria-hidden="true" />
  }
}

export const IconChevronDownOutlineRegular = glyph('chevron-down')
export const IconPaperclipOutlineRegular = glyph('paperclip')
export const IconQuestionOutlineRegular = glyph('question')
export const IconSearchOutlineRegular = glyph('search')
