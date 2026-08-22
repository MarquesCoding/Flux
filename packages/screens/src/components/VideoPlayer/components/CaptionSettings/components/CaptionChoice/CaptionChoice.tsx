import { Button } from '@ValenceUI/Button';
import type { CaptionChoiceProps } from './CaptionChoice.types';

/**
 * Lays out one decision about caption appearance as a labelled row of choices, all visible at once
 * rather than folded into a menu — with a handful of options each, seeing them side by side is
 * faster than opening a list per setting.
 *
 * @param label - What is being decided.
 * @param options - The choices, each with what to call it.
 * @param selectedId - The choice in force.
 * @param onSelect - Called with the choice the reader picked.
 */
const CaptionChoice = ({ label, options, selectedId, onSelect }: CaptionChoiceProps) => (
  <fieldset className="flex flex-col gap-2">
    <legend className="mb-2">{label}</legend>

    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => (
        <Button
          key={option.id}
          size="sm"
          isPill
          aria-pressed={option.id === selectedId}
          variant={option.id === selectedId ? 'glossy' : 'ghost'}
          onClick={() => {
            onSelect(option.id);
          }}
        >
          {option.label}
        </Button>
      ))}
    </div>
  </fieldset>
);

CaptionChoice.displayName = 'CaptionChoice';

export { CaptionChoice };
