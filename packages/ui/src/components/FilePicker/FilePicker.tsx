import { useId, useRef } from 'react';
import { cn } from '@FluxUI/cn';
import type { FilePickerProps } from './FilePicker.types';

/**
 * The one place a file is chosen. Wraps the file input that browsers insist on styling their own way
 * in a control that looks like every other control here, and hands back the file itself rather than
 * an event to be unpicked. A bare file input elsewhere is lint-banned.
 *
 * @param label - What the file is for, read out to anybody who cannot see the control.
 * @param accept - Which kinds of file to offer, as the browser's accept list.
 * @param onPick - Told the file that was chosen.
 * @param children - What the control looks like — usually an icon and a few words.
 * @param disabled - Whether a file can be chosen at all.
 * @param className - Extra classes for the caller's own layout.
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
