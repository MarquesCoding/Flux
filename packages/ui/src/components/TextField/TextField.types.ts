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
  /**
   * Whether the field is drawn as a pill.
   *
   * Matches the buttons it sits above. A square field over a pill button reads
   * as two designs sharing a form.
   */
  isPill?: boolean
  /**
   * How tall the field is.
   *
   * `lg` matches a large button, which is what a field on its own screen wants
   * to be next to.
   */
  size?: 'md' | 'lg'
  autoComplete?: HTMLInputAutoCompleteAttribute
  className?: string
}

export type { TextFieldProps, TextFieldType }
