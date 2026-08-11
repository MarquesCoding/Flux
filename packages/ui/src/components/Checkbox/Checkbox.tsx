import { useId } from 'react';
import { Checkbox as BaseCheckbox } from '@base-ui/react/checkbox';
import { IconCheck } from '@tabler/icons-react';
import { cn } from '@FluxUI/cn';
import type { CheckboxProps } from './Checkbox.types';

/**
 * A labelled checkbox built on the Base UI primitive, which supplies the
 * keyboard interaction and ARIA wiring.
 *
 * Base UI renders the control as a span with `role="checkbox"` rather than a
 * native input, so the label is associated with `aria-labelledby` and not by
 * wrapping. Implicit label association only works for labelable elements.
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
          <IconCheck size={14} stroke={3} aria-hidden />
        </BaseCheckbox.Indicator>
      </BaseCheckbox.Root>
      <span id={labelId}>{label}</span>
    </span>
  );
};

Checkbox.displayName = 'Checkbox';

export { Checkbox };
