import { useId, useRef } from 'react'
import { cn } from '@FluxUI/cn'
import type { FilePickerProps } from './FilePicker.types'

/**
 * A control for choosing one file.
 *
 * The native input is the only thing that can open a file browser, and it is
 * unstyleable, so it is hidden and a real label drives it. A label is what
 * makes this work with a keyboard and a screen reader without reimplementing
 * anything: clicking it activates the input, which is the browser's own
 * behaviour rather than a handler pretending to be one.
 */
const FilePicker = ({
  label,
  accept,
  onPick,
  children,
  disabled = false,
  className,
}: FilePickerProps) => {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <label
      htmlFor={inputId}
      className={cn(
        'inline-flex cursor-pointer items-center gap-2',
        disabled ? 'cursor-not-allowed opacity-50' : '',
        className,
      )}
    >
      <span className="sr-only">{label}</span>

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={accept}
        disabled={disabled}
        className="sr-only"
        onChange={(event) => {
          const [file] = event.target.files ?? []

          if (file !== undefined) {
            onPick(file)
          }

          // Cleared so that choosing the same file twice in a row still
          // counts as a change. A browser reports nothing when the value has
          // not moved, which reads as the second attempt being ignored.
          event.target.value = ''
        }}
      />

      {children}
    </label>
  )
}

FilePicker.displayName = 'FilePicker'

export { FilePicker }
