import { motion } from 'motion/react';
import { RevealItem } from '@FluxUI/RevealItem';
import { groupVariants } from '@FluxUI/animations/reveal';
import { RailCard } from '@FluxWeb/components/RailCard/RailCard';
import type { MediaGridProps, MediaGridSize } from './MediaGrid.types';

/**
 * How many cards each size puts across the page.
 *
 * Written out in full rather than built from a number, because Tailwind reads
 * the source for class names and a string it never sees written down is a
 * class it never generates.
 *
 * Every size climbs with the window. What the setting changes is how fast: at
 * `large` a phone still shows one card, because two on a phone are two cards
 * nobody can see anything in.
 */
const COLUMNS: Record<MediaGridSize, string> = {
  small: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6',
  medium: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
  large: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3',
};

/**
 * A page of items, laid out as a grid.
 *
 * What every page that is not the home page shows: results, a kind of thing,
 * everything kept. Rails are for a page that is arguing for something — this
 * is for a page answering a question, where the answer is a set and the shape
 * of a set is a grid.
 *
 * The same card as a rail uses, so an item looks like itself wherever it is
 * found and behaves the same when stopped on.
 *
 * The cards arrive in order rather than all at once, and how many go across is
 * the viewer's to choose: somebody looking for one thing they can half
 * remember wants as many as will fit, and somebody browsing wants to see what
 * each one is.
 */
const MediaGrid = ({
  items,
  onPlay,
  onInspect,
  watchedFractionFor,
  resumeFor,
  isKept,
  onToggleKept,
  size = 'medium',
}: MediaGridProps) => (
  <motion.ul
    variants={groupVariants}
    initial="hidden"
    animate="shown"
    className={`grid gap-x-4 gap-y-8 ${COLUMNS[size]}`}
  >
    {items.map((media, at) => (
      <RevealItem key={media.id} index={at}>
        <RailCard
          media={media}
          {...(watchedFractionFor?.(media.id) === undefined
            ? {}
            : { watchedFraction: watchedFractionFor(media.id) ?? 0 })}
          {...(resumeFor === undefined || resumeFor(media.id) === null
            ? {}
            : { resumeSeconds: Math.floor(resumeFor(media.id) ?? 0) })}
          onPlay={onPlay}
          onInspect={onInspect}
          {...(isKept === undefined ? {} : { isKept: isKept(media.id) })}
          {...(onToggleKept === undefined ? {} : { onToggleKept })}
        />
      </RevealItem>
    ))}
  </motion.ul>
);

MediaGrid.displayName = 'MediaGrid';

export { MediaGrid };
