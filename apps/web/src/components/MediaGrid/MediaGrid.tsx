import { motion } from 'motion/react';
import { RevealItem } from '@FluxUI/RevealItem';
import { groupVariants } from '@FluxUI/animations/reveal';
import { RailCard } from '@FluxWeb/components/RailCard/RailCard';
import type { MediaGridProps, MediaGridSize } from './MediaGrid.types';

const COLUMNS: Record<MediaGridSize, string> = {
  small: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6',
  medium: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
  large: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3',
};

/**
 * Lays a page of items out as a grid of cards, at whichever size a viewer chose. Each card carries
 * how far through it they are and whether they have kept it, both asked of the caller rather than
 * fetched here.
 *
 * @param items - What to draw.
 * @param onPlay - Told to start something, and where from.
 * @param onInspect - Told to open the page about something.
 * @param watchedFractionFor - How far through each item this viewer is.
 * @param resumeFor - Where they left each item.
 * @param isKept - Whether each item is kept.
 * @param onToggleKept - Told to keep something, or stop.
 * @param size - How large the cards are.
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
