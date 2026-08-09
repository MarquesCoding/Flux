import { useId } from 'react'
import cnModule from '@FluxUI/cn'
import type { TextFieldProps } from './TextField.types'

const { cn } = cnModule

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
          'h-10 rounded-md border border-border bg-surface-raised px-3 text-text',
          'placeholder:text-text-muted',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
          'disabled:cursor-not-allowed disabled:opacity-50',
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

export default { TextField }
