import { Icon } from '@FluxUI/Icon';
import { CheckIcon } from '@phosphor-icons/react';
import { useId } from 'react';
import * as RadixCheckbox from '@radix-ui/react-checkbox';
import { cn } from '@FluxUI/cn';
import type { CheckboxProps } from './Checkbox.types';

/**
 * A labelled checkbox, for a choice that is part of a form rather than one that takes effect at
 * once — a switch is the control for that. Built on the headless primitive, which supplies the
 * keyboard interaction and the ARIA wiring that are expensive to get right and dangerous to get
 * wrong.
 *
 * @param label - What ticking it means.
 * @param checked - Whether it is ticked, for a caller holding the state.
 * @param defaultChecked - Whether it starts ticked, for a caller that would rather not.
 * @param disabled - Whether it can be changed at all.
 * @param onCheckedChange - Told the new state when it changes.
 * @param className - Extra classes for the caller's own layout.
 */
const Checkbox = ({
  label,
  checked,
  defaultChecked,
  disabled = false,
  onCheckedChange,
  className,
}: CheckboxProps) => {
  const labelId = useId();

  return (
    <span className={cn('inline-flex items-center gap-2 text-text', className)}>
      <RadixCheckbox.Root
        {...(checked === undefined ? {} : { checked })}
        {...(defaultChecked === undefined ? {} : { defaultChecked })}
        {...(onCheckedChange === undefined ? {} : { onCheckedChange })}
        disabled={disabled}
        aria-labelledby={labelId}
        data-slot="checkbox"
        className={cn(
          'flex size-5 shrink-0 items-center justify-center rounded-sm border border-input',
          'bg-secondary outline-none',
          'transition-colors duration-[var(--duration-instant)] ease-[var(--ease-out)]',
          'motion-reduce:transition-none',
          'focus-visible:ring-[3px] focus-visible:ring-ring/40',
          'data-[state=checked]:border-primary data-[state=checked]:bg-primary',
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
      >
        <RadixCheckbox.Indicator className="flex text-primary-foreground animate-in zoom-in-75 duration-[var(--duration-instant)] motion-reduce:animate-none">
          <Icon of={CheckIcon} size={14} />
        </RadixCheckbox.Indicator>
      </RadixCheckbox.Root>
      <span id={labelId}>{label}</span>
    </span>
  );
};

Checkbox.displayName = 'Checkbox';

export { Checkbox };
