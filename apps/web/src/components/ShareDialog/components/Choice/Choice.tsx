import { RiArrowDownSLine } from '@remixicon/react';
import { OptionMenu } from '@FluxUI/OptionMenu';
import type { ChoiceProps } from './Choice.types';

/**
 * One decision in the form, as the platform's own menu. Written once here because the dialog asks
 * three questions of exactly the same shape, and three hand-built menus would drift apart.
 *
 * @param label - What is being decided.
 * @param options - The choices.
 * @param value - The choice in force.
 * @param onSelect - Called with the choice made.
 * @returns The menu.
 */
const Choice = ({ label, options, value, onSelect }: ChoiceProps) => (
  <span className="flex items-center justify-between gap-3">
    <span className="text-sm text-text-muted">{label}</span>

    <OptionMenu
      label={label}
      groups={[{ name: label, options: [...options], selectedId: value, onSelect }]}
      trigger={
        <span className="flex items-center gap-1.5 text-sm font-medium text-text">
          {options.find((one) => one.id === value)?.label ?? ''}
          <RiArrowDownSLine size={16} aria-hidden />
        </span>
      }
    />
  </span>
);

Choice.displayName = 'Choice';

export { Choice };
