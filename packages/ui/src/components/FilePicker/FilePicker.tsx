import { useId, useRef } from 'react';
import { cn } from '@FluxUI/cn';
import type { FilePickerProps } from './FilePicker.types';

/**
 * A control for choosing one file.
 */
const FilePicker = ({
  label,
  accept,
  onPick,
  children,
  disabled = false,
  className,
}: FilePickerProps) => {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

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
          const [file] = event.target.files ?? [];

          if (file !== undefined) {
            onPick(file);
          }

          event.target.value = '';
        }}
      />

      {children}
    </label>
  );
};

FilePicker.displayName = 'FilePicker';

export { FilePicker };
