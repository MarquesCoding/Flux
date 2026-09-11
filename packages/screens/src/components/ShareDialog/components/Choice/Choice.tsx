import { Icon } from '@ValenceUI/Icon';
import { ArrowDown01Icon } from '@hugeicons/core-free-icons';
import { OptionMenu } from '@ValenceUI/OptionMenu';
import type { ChoiceProps } from './Choice.types';

/**
 * One decision in the form, as the platform's own menu. Written once here because the dialog asks
 * three questions of exactly the same shape, and three hand-built menus would drift apart.
 *
 * The answer takes whatever room the question leaves and sits against the right edge of it, which
 * on any normal panel is room enough to read it whole. Shortening only happens where it genuinely
 * will not fit.
 *
 * It is claimed rather than merely allowed. `OptionMenu` holds its trigger against shrinking, which
 * suits the icons it was built around; overriding that to let it shrink let it collapse to a letter
 * and an ellipsis while most of the row stood empty, since a flex item told it may shrink and given
 * no reason to grow takes the smallest width its content permits.
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
      className="min-w-0 flex-1 justify-end"
      groups={[{ name: label, options: [...options], selectedId: value, onSelect }]}
      trigger={
        <span className="flex min-w-0 items-center justify-end gap-1.5 text-sm font-medium text-text">
          <span className="truncate">{options.find((one) => one.id === value)?.label ?? ''}</span>
          <Icon of={ArrowDown01Icon} size={16} className="shrink-0" />
        </span>
      }
    />
  </span>
);

Choice.displayName = 'Choice';

export { Choice };
