import { RiArrowDownSLine } from '@remixicon/react';
import { OptionMenu } from '@FluxUI/OptionMenu';
import type { ChoiceProps } from './Choice.types';

/**
 * One decision in the form, as the platform's own menu. Written once here because the dialog asks
 * three questions of exactly the same shape, and three hand-built menus would drift apart.
 *
 * The answer is given the room and the question keeps its own, so a long answer runs out of space
 * against the right edge of the panel rather than through it. Allowed to wrap it folded onto three
 * lines; stopped from wrapping it ran off the card and took the arrow with it, leaving a menu with
 * nothing to say it was one. Truncating is the only one of the three that stays inside the panel and
 * still looks like a choice — and the whole answer is a press away regardless.
 *
 * @param label - What is being decided.
 * @param options - The choices.
 * @param value - The choice in force.
 * @param onSelect - Called with the choice made.
 * @returns The menu.
 */
const Choice = ({ label, options, value, onSelect }: ChoiceProps) => (
  <span className="flex items-center justify-between gap-4">
    <span className="shrink-0 text-sm text-text-muted">{label}</span>

    <OptionMenu
      label={label}
      className="min-w-0 shrink"
      groups={[{ name: label, options: [...options], selectedId: value, onSelect }]}
      trigger={
        <span className="flex min-w-0 items-center justify-end gap-1.5 text-sm font-medium text-text">
          <span className="truncate">{options.find((one) => one.id === value)?.label ?? ''}</span>
          <RiArrowDownSLine size={16} aria-hidden className="shrink-0" />
        </span>
      }
    />
  </span>
);

Choice.displayName = 'Choice';

export { Choice };
