import { Button } from '@FluxUI/Button';
import type { FilterChipsProps } from './FilterChips.types';

/**
 * One thing to narrow by, offered as a row of chips.
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
