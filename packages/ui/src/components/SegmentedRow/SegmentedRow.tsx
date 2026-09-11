import { cn } from '@ValenceUI/cn';
import { Button } from '@ValenceUI/Button';
import { SlidingMark } from '@ValenceUI/SlidingMark';
import { SEGMENTED } from '@ValenceUI/tokens/segmented';
import type { SegmentedRowProps } from './SegmentedRow.types';

/**
 * A set of choices drawn as one track rather than as separate pills: a single rounded rail with the
 * chosen one lit inside it. The difference matters — a row of individually bordered pills reads as
 * several buttons that happen to be adjacent, where one track reads as a single control with a
 * setting, which is what choosing between libraries actually is.
 *
 * For choices that change what is shown without changing where you are. Where the choices are
 * panels under a bar, `TabRow` is the same track wired to those panels instead.
 *
 * @param label - What the choice is about, read out to anybody who cannot see it.
 * @param size - How large the track stands.
 * @param tone - How the chosen one is lit: inverted where the row is where you are, and tinted
 *   where it is a setting inside a dialog rather than a place to go.
 * @param items - The choices, in the order they should be offered; one marked absent is drawn
 *   fainter, for a choice that can be made but which this server has nothing behind.
 * @param value - Which one is chosen, so the mark can travel to it.
 * @param onSelect - Told which one was pressed.
 * @param className - Extra classes for the caller's own layout.
 */
const SegmentedRow = ({
  label,
  items,
  value,
  onSelect,
  size = 'md',
  tone = 'inverted',
  className,
}: SegmentedRowProps) => (
  <div
    role="group"
    aria-label={label}
    className={cn(
      SEGMENTED.track,
      SEGMENTED.tones[tone].track,
      SEGMENTED.trackSizes[size],
      className,
    )}
  >
    {items.map((item) => (
      <Button
        key={item.id}
        variant="bare"
        size="none"
        isActive={item.id === value}
        hasTooltip={false}
        className={cn(
          SEGMENTED.item,
          SEGMENTED.itemSizes[size],
          item.id === value ? SEGMENTED.tones[tone].chosen : '',
          item.isAbsent === true && item.id !== value ? 'text-text-muted/60' : '',
        )}
        onClick={() => {
          onSelect(item.id);
        }}
      >
        {item.id === value ? (
          <SlidingMark group={`segmented-${label}`} className={SEGMENTED.tones[tone].mark} />
        ) : null}
        {item.label}
      </Button>
    ))}
  </div>
);

SegmentedRow.displayName = 'SegmentedRow';

export { SegmentedRow };
