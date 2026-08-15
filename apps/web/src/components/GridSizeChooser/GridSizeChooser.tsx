import { useState } from 'react';
import { RiGridLine, RiLayoutGrid2Line, RiLayoutGridLine } from '@remixicon/react';
import { Button } from '@FluxUI/Button';
import { SlidingMark } from '@FluxUI/SlidingMark';
import { cn } from '@FluxUI/cn';
import type { RemixiconComponentType } from '@remixicon/react';
import type { MediaGridSize } from '@FluxWeb/components/MediaGrid/MediaGrid.types';
import type { GridSizeChooserProps } from './GridSizeChooser.types';

/**
 * The three sizes, smallest first, each drawn as what it does.
 *
 * A grid of nine, a grid of six and a grid of four: the glyph is the layout it
 * produces, so the row can be read without being tried. Ordered smallest to
 * largest because that is the direction the cards grow in, and a row of sizes
 * that runs the other way has to be read twice.
 */
const SIZES: readonly {
  id: MediaGridSize;
  label: string;
  Icon: RemixiconComponentType;
}[] = [
  { id: 'small', label: 'Small cards, more of them', Icon: RiGridLine },
  { id: 'medium', label: 'Medium cards', Icon: RiLayoutGridLine },
  { id: 'large', label: 'Large cards, fewer of them', Icon: RiLayoutGrid2Line },
];

/**
 * How large the cards on a page of results are.
 *
 * Three presses rather than a menu, because this is a setting somebody adjusts
 * by looking: they press one, see the page, and press the next. A menu makes
 * that two presses each way and closes over the thing being judged.
 *
 * Named in words rather than by the glyph alone — "large cards, fewer of them"
 * says what changes, where "large" on its own leaves it to be guessed at.
 *
 * One mark, as the dock has: it rests on the size in force, follows the
 * pointer to whatever it passes over, and returns the moment the pointer
 * leaves. A row this small was the worst place to have a highlight that jumps,
 * since the three sit close enough that a swap reads as a flicker rather than
 * as a move.
 */
const GridSizeChooser = ({ value, onValueChange, className }: GridSizeChooserProps) => {
  const [pointedAt, setPointedAt] = useState<MediaGridSize | null>(null);

  const lit = pointedAt ?? value;

  return (
    <div
      role="group"
      aria-label="How large the cards are"
      onPointerLeave={() => {
        setPointedAt(null);
      }}
      onBlur={() => {
        setPointedAt(null);
      }}
      className={cn('flux-glass flex items-center gap-1 rounded-full p-1', className)}
    >
      {SIZES.map(({ id, label, Icon }) => (
        <Button
          key={id}
          isIconOnly
          variant="bare"
          size="none"
          isActive={value === id}
          label={label}
          onPointerEnter={() => {
            setPointedAt(id);
          }}
          onFocus={() => {
            setPointedAt(id);
          }}
          onClick={() => {
            onValueChange(id);
          }}
          className={cn(
            'relative flex size-8 items-center justify-center rounded-full',
            'transition-colors duration-[var(--duration-fast)] ease-[var(--ease-soft)]',
            lit === id ? 'text-text' : 'text-text-muted',
          )}
        >
          {lit === id ? <SlidingMark group="grid-size-mark" /> : null}

          <Icon size={16} aria-hidden />
        </Button>
      ))}
    </div>
  );
};

GridSizeChooser.displayName = 'GridSizeChooser';

export { GridSizeChooser };
