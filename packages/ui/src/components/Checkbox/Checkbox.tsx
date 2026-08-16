import { useId } from 'react';
import { Checkbox as BaseCheckbox } from '@base-ui/react/checkbox';
import { RiCheckLine } from '@remixicon/react';
import { cn } from '@FluxUI/cn';
import type { CheckboxProps } from './Checkbox.types';

/**
 * A labelled checkbox, for a choice that is part of a form rather than one that takes effect at
 * once — a switch is the control for that. Built on the Base UI primitive, which supplies the
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
      <BaseCheckbox.Root
        {...(checked === undefined ? {} : { checked })}
        {...(defaultChecked === undefined ? {} : { defaultChecked })}
        {...(onCheckedChange === undefined ? {} : { onCheckedChange })}
        disabled={disabled}
        aria-labelledby={labelId}
        className={cn(
          'flex size-5 items-center justify-center rounded-sm border border-border',
          'bg-surface-raised transition-colors',
          'data-[checked]:border-accent data-[checked]:bg-accent',
          'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
        )}
      >
        <BaseCheckbox.Indicator className="flex text-accent-contrast">
          <RiCheckLine size={14} aria-hidden />
        </BaseCheckbox.Indicator>
      </BaseCheckbox.Root>
      <span id={labelId}>{label}</span>
    </span>
  );
};

Checkbox.displayName = 'Checkbox';

export { Checkbox };
