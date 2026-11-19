// src/client/components/card/CardAnswer.tsx
//
// 「输入你的答案」一行，两种形态：
// - 可编辑：自动增高文本域（镜像层撑高，文本域自身滚动），
//   前面是与序号同尺寸的编辑图标座位；
// - 只读：已决卡把当时写下的答案原文显示出来，空答案不占位。

import type { ChangeEvent, ReactElement } from 'react'

export interface CardAnswerFieldProps {
  value: string
  placeholder: string
  disabled: boolean
  onChange: (value: string) => void
}

export function CardAnswerField({
  value,
  placeholder,
  disabled,
  onChange,
}: CardAnswerFieldProps): ReactElement {
  const change = (event: ChangeEvent<HTMLTextAreaElement>): void => onChange(event.target.value)
  return (
    <div className="pa-detail__answer" data-active={value.length > 0 || undefined}>
      <span className="pa-detail__answer-seat" aria-hidden="true">
        {'\u270E'}
      </span>
      <div className="pa-detail__answer-field">
        <div aria-hidden="true" className="pa-detail__answer-mirror">{`${value}\n`}</div>
        <textarea
          className="pa-detail__answer-input"
          value={value}
          rows={1}
          disabled={disabled}
          placeholder={placeholder}
          onChange={change}
        />
      </div>
    </div>
  )
}

export interface CardAnswerTextProps {
  /** 当时填写的答案原文；空白时不渲染。 */
  answer: string
}

export function CardAnswerText({ answer }: CardAnswerTextProps): ReactElement | null {
  if (answer.trim().length === 0) return null
  return (
    <div className="pa-detail__answer pa-detail__answer--readonly">
      <span className="pa-detail__answer-seat" aria-hidden="true">
        {'\u270E'}
      </span>
      <span className="pa-detail__answer-text">{answer}</span>
    </div>
  )
}
