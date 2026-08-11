import { useId } from 'react'
import { cn } from '@FluxUI/cn'
import type { TextFieldProps } from './TextField.types'

/**
 * A labelled single-line text input.
 *
 * This is the only place a raw `<input>` is permitted for text entry; see code
 * standards section 9. The label is a real `<label for>` because the control is
 * a native input and therefore labelable.
 */
const TextField = ({
  label,
  value,
  onValueChange,
  type = 'text',
  description,
  error,
  placeholder,
  required = false,
  disabled = false,
  autoComplete,
  isPill = false,
  size = 'md',
  className,
}: TextFieldProps) => {
  const inputId = useId()
  const descriptionId = useId()
  const errorId = useId()

  const describedBy = [
    description === undefined ? null : descriptionId,
    error === undefined ? null : errorId,
  ]
    .filter((id) => id !== null)
    .join(' ')

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={inputId} className="text-sm font-medium text-text">
        {label}
      </label>

      {description === undefined ? null : (
        <p id={descriptionId} className="text-sm text-text-muted">
          {description}
        </p>
      )}

      <input
        id={inputId}
        type={type}
        value={value}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        aria-invalid={error !== undefined}
        aria-describedby={describedBy === '' ? undefined : describedBy}
        {...(autoComplete === undefined ? {} : { autoComplete })}
        onChange={(event) => {
          onValueChange(event.target.value)
        }}
        className={cn(
          // `flux-field` carries the one thing Tailwind cannot: a browser
          // painting its own pale background over an autofilled field, which
          // turns a dark form white the moment somebody's password manager
          // touches it.
          'flux-field border border-white/10 bg-white/[0.04] text-text backdrop-blur-xl',
          'transition-colors placeholder:text-text-muted hover:border-white/20',
          'disabled:cursor-not-allowed disabled:opacity-50',
          size === 'lg' ? 'h-14 px-5 text-base' : 'h-10 px-3 text-sm',
          isPill ? 'rounded-full' : 'rounded-xl',
          error === undefined ? '' : 'border-danger',
        )}
      />

      {error === undefined ? null : (
        <p id={errorId} role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  )
}

TextField.displayName = 'TextField'

export { TextField }
