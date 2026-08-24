import { useState } from 'react';
import { Checkbox } from '@ValenceUI/Checkbox';
import { SegmentedRow } from '@ValenceUI/SegmentedRow';
import type { WebhookFilterListProps } from './WebhookFilterList.types';

const EVERYONE = 'everyone';

const SOME = 'some';

/**
 * One allowlist on a subscription: everybody, or a list of names.
 *
 * There are two states and the control has two segments, which is the whole of it. A tick-everything
 * button cannot express this, because an empty list already means everybody — pressing it a second
 * time has nothing left to do, which reads as a button that does not work.
 *
 * Saying what each list decides is the reason there are several of them rather than one wall of
 * names. An operator picking faces is choosing whose viewing gets reported; an operator picking
 * accounts is choosing whose sign-ins do. Those are different questions about different people.
 *
 * Everybody is stored as an empty list rather than as a list of today's names, so that somebody added
 * tomorrow is included too.
 *
 * @param title - What this list is of.
 * @param governs - Which events it decides, said plainly.
 * @param choices - What can be picked.
 * @param chosen - What is picked, empty meaning everybody.
 * @param nothingToChoose - What to say where there is nothing to pick from at all.
 * @param onChange - Told the new selection.
 */
const WebhookFilterList = ({
  title,
  governs,
  choices,
  chosen,
  nothingToChoose,
  onChange,
}: WebhookFilterListProps) => {
  const [isPicking, setIsPicking] = useState(chosen.length > 0);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-text">{title}</span>
        <span className="text-xs text-text-muted">{governs}</span>
      </div>

      {choices.length === 0 ? (
        <span className="text-xs text-text-muted">{nothingToChoose}</span>
      ) : (
        <>
          <SegmentedRow
            label={`Which ${title.toLowerCase()}`}
            tone="accent"
            size="sm"
            items={[
              { id: EVERYONE, label: 'Everybody' },
              { id: SOME, label: 'Only these' },
            ]}
            value={isPicking ? SOME : EVERYONE}
            onSelect={(id) => {
              setIsPicking(id === SOME);

              if (id === EVERYONE) {
                onChange([]);
              }
            }}
          />

          {isPicking ? (
            <div role="group" aria-label={title} className="flex flex-col gap-1.5 pt-1">
              {choices.map((choice) => (
                <Checkbox
                  key={choice.id}
                  label={choice.label}
                  checked={chosen.includes(choice.id)}
                  onCheckedChange={(checked) => {
                    onChange(
                      checked
                        ? [...chosen, choice.id]
                        : chosen.filter((held) => held !== choice.id),
                    );
                  }}
                />
              ))}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
};

WebhookFilterList.displayName = 'WebhookFilterList';

export { WebhookFilterList };
