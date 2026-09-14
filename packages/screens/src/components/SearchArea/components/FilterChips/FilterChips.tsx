import { Button } from '@ValenceUI/Button';
import type { FilterChipsProps } from './FilterChips.types';

/**
 * One thing to narrow a search by, offered as a row of chips rather than a menu — every one of these
 * lists is short and already filtered to what the libraries actually hold, and the whole point of the
 * row is seeing what there is to ask for. Pressing the chosen chip clears it, since a filter somebody
 * can only add is one they have to hunt for a way out of.
 *
 * @param legend - What the row narrows.
 * @param options - What there is to choose from.
 * @param value - What is chosen, or nothing.
 * @param onValueChange - Told the new choice, or nothing when the chosen one was pressed again.
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
