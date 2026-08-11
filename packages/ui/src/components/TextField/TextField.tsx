import { useId } from 'react';
import { cn } from '@FluxUI/cn';
import type { TextFieldProps } from './TextField.types';

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
  isBare = false,
  isLabelHidden = false,
  icon,
  hasFocusOnMount = false,
  className,
}: TextFieldProps) => {
  const inputId = useId();
  const descriptionId = useId();
  const errorId = useId();

  const describedBy = [
    description === undefined ? null : descriptionId,
    error === undefined ? null : errorId,
  ]
    .filter((id) => id !== null)
    .join(' ');

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label
        htmlFor={inputId}
        className={cn('text-sm font-medium text-text', isLabelHidden ? 'sr-only' : '')}
      >
        {label}
      </label>

      {description === undefined ? null : (
        <p id={descriptionId} className="text-sm text-text-muted">
          {description}
        </p>
      )}

      <span
        className={cn('flex items-center gap-3', isBare ? 'border-b border-white/15 pb-3' : '')}
      >
        {icon === undefined ? null : <span className="shrink-0 text-text-muted">{icon}</span>}

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
            onValueChange(event.target.value);
          }}
          autoFocus={hasFocusOnMount}
          className={cn(
            'flux-field text-text',
            'transition-colors placeholder:text-text-muted',
            'disabled:cursor-not-allowed disabled:opacity-50',
            isBare
              ? 'w-full bg-transparent outline-none'
              : 'border border-white/10 bg-white/[0.04] backdrop-blur-xl hover:border-white/20',
            isBare
              ? ''
              : size === 'lg'
                ? 'h-14 px-5 text-base'
                : size === 'xl'
                  ? 'h-16 px-6 text-lg'
                  : 'h-10 px-3 text-sm',
            isBare && size === 'xl' ? 'text-2xl tracking-tight sm:text-3xl' : '',
            isBare ? '' : isPill ? 'rounded-full' : 'rounded-xl',
            error === undefined ? '' : 'border-danger',
          )}
        />
      </span>

      {error === undefined ? null : (
        <p id={errorId} role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
};

TextField.displayName = 'TextField';

export { TextField };
