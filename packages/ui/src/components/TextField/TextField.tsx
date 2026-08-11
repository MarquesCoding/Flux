import { Field } from '@base-ui/react/field';
import { cn } from '@FluxUI/cn';
import type { TextFieldProps } from './TextField.types';

/**
 * A labelled single-line text input.
 *
 * This is the only place text entry is written; see code standards section 9.
 * The label, the description, the error and the wiring between them are Base
 * UI's `Field`, which owns the part that is easy to get subtly wrong: which
 * element describes which, and what a reader is told when a field goes invalid.
 * What is left here is what the field looks like.
 *
 * A `time` field is told the surface under it is dark, because the browser
 * paints the clock button it draws for itself for a light page otherwise.
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
  min,
  max,
  autoComplete,
  isPill = false,
  size = 'md',
  isBare = false,
  isLabelHidden = false,
  icon,
  hasFocusOnMount = false,
  className,
}: TextFieldProps) => (
  <Field.Root
    disabled={disabled}
    invalid={error !== undefined}
    className={cn('flex flex-col gap-1.5', className)}
  >
    <Field.Label className={cn('text-sm font-medium text-text', isLabelHidden ? 'sr-only' : '')}>
      {label}
    </Field.Label>

    {description === undefined ? null : (
      <Field.Description className="text-sm text-text-muted">{description}</Field.Description>
    )}

    <span className={cn('flex items-center gap-3', isBare ? 'border-b border-white/15 pb-3' : '')}>
      {icon === undefined ? null : <span className="shrink-0 text-text-muted">{icon}</span>}

      <Field.Control
        type={type}
        value={value}
        placeholder={placeholder}
        required={required}
        {...(autoComplete === undefined ? {} : { autoComplete })}
        {...(min === undefined ? {} : { min })}
        {...(max === undefined ? {} : { max })}
        onValueChange={(next) => {
          onValueChange(next);
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
          type === 'time' ? '[color-scheme:dark]' : '',
          isBare ? '' : isPill ? 'rounded-full' : 'rounded-xl',
          error === undefined ? '' : 'border-danger',
        )}
      />
    </span>

    {error === undefined ? null : (
      <Field.Error match role="alert" className="text-sm text-danger">
        {error}
      </Field.Error>
    )}
  </Field.Root>
);

TextField.displayName = 'TextField';

export { TextField };
