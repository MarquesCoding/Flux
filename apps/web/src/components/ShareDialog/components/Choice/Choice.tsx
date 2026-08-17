import { RiArrowDownSLine } from '@remixicon/react';
import { OptionMenu } from '@FluxUI/OptionMenu';
import type { ChoiceProps } from './Choice.types';

/**
 * One decision in the form, as the platform's own menu. Written once here because the dialog asks
 * three questions of exactly the same shape, and three hand-built menus would drift apart.
 *
 * The answer is kept on one line and the question gives way instead. Left to wrap, "Anybody with the
 * link" folded onto three lines in a column of its own making, which read as a fault rather than as
 * a choice.
 *
 * @param label - What is being decided.
 * @param options - The choices.
 * @param value - The choice in force.
 * @param onSelect - Called with the choice made.
 * @returns The menu.
 */
const Choice = ({ label, options, value, onSelect }: ChoiceProps) => (
  <span className="flex items-center justify-between gap-4">
    <span className="min-w-0 truncate text-sm text-text-muted">{label}</span>

    <OptionMenu
      label={label}
      groups={[{ name: label, options: [...options], selectedId: value, onSelect }]}
      trigger={
        <span className="flex shrink-0 items-center gap-1.5 whitespace-nowrap text-sm font-medium text-text">
          {options.find((one) => one.id === value)?.label ?? ''}
          <RiArrowDownSLine size={16} aria-hidden />
        </span>
      }
    />
  </span>
);

Choice.displayName = 'Choice';

export { Choice };
