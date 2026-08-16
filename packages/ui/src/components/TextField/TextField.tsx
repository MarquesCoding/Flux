import { Field } from '@base-ui/react/field';
import { cn } from '@FluxUI/cn';
import type { TextFieldProps } from './TextField.types';

/**
 * The one place a single line of text is typed. Owns the label, the description and the error
 * together, so a field is always announced with whatever explains it rather than leaving a caller to
 * remember the wiring. Every text input in Flux is this or composes it — a bare input elsewhere is
 * lint-banned.
 *
 * @param label - What is being asked for, shown unless the caller hides it.
 * @param value - What the field holds now.
 * @param onValueChange - Told the new text on every keystroke.
 * @param type - Which kind of input, such as a search box or a password.
 * @param description - A line under the field explaining what is wanted.
 * @param error - What is wrong with what was typed, which replaces the description.
 * @param placeholder - What to show while the field is empty.
 * @param required - Whether the form refuses to submit without it.
 * @param disabled - Whether it can be typed in at all.
 * @param min - The smallest acceptable value, for a numeric field.
 * @param max - The largest acceptable value, for a numeric field.
 * @param isPill - Whether to round it fully, for a field sitting in a bar rather than a form.
 * @param size - How large to draw it.
 * @param isBare - Whether to paint no box at all, for a field that supplies its own surface.
 * @param icon - Something to draw inside the field, such as a magnifying glass.
 * @param hasFocusOnMount - Whether to put the cursor here as soon as it appears.
 * @param className - Extra classes for the caller's own layout.
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

    <span
      className={cn(
        'flex w-full items-center gap-3',
        isBare ? 'border-b border-[var(--surface-line)] pb-3' : '',
      )}
    >
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
          'w-full',
          isBare
            ? 'bg-transparent outline-none'
            : 'border border-[var(--surface-line)] bg-[var(--surface-hover)] backdrop-blur-xl hover:border-[var(--surface-divider)]',
          isBare
            ? ''
            : size === 'sm'
              ? 'h-7 px-2.5 text-xs'
              : size === 'lg'
                ? 'h-10 px-5 text-sm'
                : size === 'xl'
                  ? 'h-12 px-6 text-base'
                  : 'h-9 px-3.5 text-sm',
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
