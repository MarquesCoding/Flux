import { Button } from '@FluxUI/Button';
import type { FilterChipsProps } from './FilterChips.types';

/**
 * One thing to narrow by, offered as a row of chips.
 *
 * Chips rather than a dropdown because every one of these lists is short and
 * already filtered to what the library actually holds: a menu hides five
 * options behind a press, and the whole point of the row is being able to see
 * what there is to ask for.
 *
 * Nothing is drawn at all when there are no options, so a library with no
 * ratings or one language does not carry a heading over an empty space.
 */
const FilterChips = ({ legend, options, value, onValueChange }: FilterChipsProps) => {
  if (options.length === 0) {
    return null;
  }

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="pb-2 text-xs font-medium uppercase tracking-wide text-text-muted">
        {legend}
      </legend>

      <ul className="flex flex-wrap gap-2">
        {options.map((option) => (
          <li key={option.value}>
            <Button
              size="sm"
              isPill
              variant={option.value === value ? 'glossy' : 'ghost'}
              isActive={option.value === value}
              onClick={() => {
                onValueChange(option.value === value ? null : option.value);
              }}
            >
              {option.label}
            </Button>
          </li>
        ))}
      </ul>
    </fieldset>
  );
};

FilterChips.displayName = 'FilterChips';

export { FilterChips };
