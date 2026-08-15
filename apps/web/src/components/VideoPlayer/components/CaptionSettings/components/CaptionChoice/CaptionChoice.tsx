import { Button } from '@FluxUI/Button';
import type { CaptionChoiceProps } from './CaptionChoice.types';

/**
 * One decision about how captions look, laid out flat.
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
