import { Icon } from '@FluxUI/Icon';
import { GridFourIcon, SquaresFourIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { Button } from '@FluxUI/Button';
import { SlidingMark } from '@FluxUI/SlidingMark';
import { cn } from '@FluxUI/cn';
import type { MediaGridSize } from '@FluxScreens/components/MediaGrid/MediaGrid.types';
import type { Icon as PhosphorIcon } from '@phosphor-icons/react';
import type { GridSizeChooserProps } from './GridSizeChooser.types';

const SIZES: readonly {
  id: MediaGridSize;
  label: string;
  glyph: PhosphorIcon;
}[] = [
  { id: 'small', label: 'Small cards, more of them', glyph: GridFourIcon },
  { id: 'medium', label: 'Medium cards', glyph: SquaresFourIcon },
  { id: 'large', label: 'Large cards, fewer of them', glyph: GridFourIcon },
];

/**
 * Chooses how large the cards on a page are, as three presses rather than a menu — this is a setting
 * somebody adjusts by looking, and a menu makes that two presses each way while covering the thing
 * being judged. Carries the dock's travelling mark, since the three sit close enough that a
 * highlight which jumps reads as a flicker.
 *
 * @param value - The size in force.
 * @param onValueChange - Told which size was chosen.
 * @param className - Extra classes for the caller's own layout.
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
      {SIZES.map(({ id, label, glyph }) => (
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

          <Icon of={glyph} size={16} />
        </Button>
      ))}
    </div>
  );
};

GridSizeChooser.displayName = 'GridSizeChooser';

export { GridSizeChooser };
