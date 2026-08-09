import type { HTMLInputAutoCompleteAttribute } from 'react'

type TextFieldType = 'text' | 'email' | 'password' | 'url'

type TextFieldProps = {
  label: string
  value: string
  onValueChange: (value: string) => void
  type?: TextFieldType
  description?: string
  error?: string
  placeholder?: string
  required?: boolean
  disabled?: boolean
  autoComplete?: HTMLInputAutoCompleteAttribute
  className?: string
}

export type { TextFieldProps, TextFieldType }
