import { RiGridLine, RiLayoutGrid2Line, RiLayoutGridLine } from '@remixicon/react';
import { Button } from '@FluxUI/Button';
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
 */
const GridSizeChooser = ({ value, onValueChange, className }: GridSizeChooserProps) => (
  <div
    role="group"
    aria-label="How large the cards are"
    className={cn('flux-glass flex items-center gap-1 rounded-full p-1', className)}
  >
    {SIZES.map(({ id, label, Icon }) => (
      <Button
        key={id}
        isIconOnly
        isPill
        size="sm"
        variant={value === id ? 'secondary' : 'ghost'}
        isActive={value === id}
        label={label}
        onClick={() => {
          onValueChange(id);
        }}
        className={cn(
          'text-text-muted transition-colors',
          value === id ? 'text-text' : 'hover:text-text',
        )}
      >
        <Icon size={16} aria-hidden />
      </Button>
    ))}
  </div>
);

GridSizeChooser.displayName = 'GridSizeChooser';

export { GridSizeChooser };
