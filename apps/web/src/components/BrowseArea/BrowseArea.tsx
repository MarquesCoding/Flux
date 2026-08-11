import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Spinner } from '@FluxUI/Spinner';
import { revealVariants, revealTransition, staggerVariants } from '@FluxUI/animations/reveal';
import { fetchLibraries, fetchLibraryItems } from '@FluxWeb/library/fetchLibrary';
import { MediaGrid } from '@FluxWeb/components/MediaGrid/MediaGrid';
import type { MediaSummary } from '@FluxContracts/schemas/Library';
import type { BrowseAreaProps, BrowseKind } from './BrowseArea.types';

/**
 * How many items a browse page holds at once.
 */
const PAGE_SIZE = 120;

/**
 * What each page is called, and what it says when it has nothing.
 *
 * The empty line is the useful half. A page that says nothing when it is empty
 * looks broken; one that says why it is empty and what would fill it is a page
 * doing its job on a bad day.
 */
const PAGES: Record<BrowseKind, { title: string; standfirst: string; empty: string }> = {
  shows: {
    title: 'Shows',
    standfirst: 'Everything that comes in episodes.',
    empty:
      'Nothing here belongs to a series yet. Anything with a season and an episode lands here.',
  },
  films: {
    title: 'Films',
    standfirst: 'Everything that stands on its own.',
    empty: 'Nothing here stands on its own yet. Anything that is not part of a series lands here.',
  },
  new: {
    title: 'New & Popular',
    standfirst: 'The most recent arrivals, newest first.',
    empty:
      'Nothing has arrived yet. Scanning a library from the admin page is where things come from.',
  },
  favourites: {
    title: 'Favourites',
    standfirst: 'Everything you have kept.',
    empty: 'Nothing kept yet. The heart on any item puts it here.',
  },
};

/**
 * A page of the library, asked one question.
 *
 * Four pages that are the same page: what comes in episodes, what does not,
 * what arrived most recently, and what this viewer kept. Each is one query
 * against the library rather than a shape of its own, which is why they are
 * one component — four near-identical pages is four places to fix a card.
 *
 * Asked of the server rather than sifted here, for the same reason searching
 * is: a library is longer than a page of it, and filtering whatever arrived
 * first answers with the first hundred items rather than with the answer.
 */
const BrowseArea = ({
  kind,
  onPlay,
  onInspect,
  onItemsLoaded,
  watchedFractionFor,
  resumeFor,
  favourites = [],
  isKept,
  onToggleKept,
}: BrowseAreaProps) => {
  const [libraryIds, setLibraryIds] = useState<string[]>([]);
  const [items, setItems] = useState<MediaSummary[]>([]);
  const [isReading, setIsReading] = useState(true);
  const prefersReducedMotion = useReducedMotion();
  const page = PAGES[kind];

  // Stable, so telling the page what was found cannot start the read that
  // found it all over again.
  const reportItems = useRef(onItemsLoaded);

  reportItems.current = onItemsLoaded;

  useEffect(() => {
    void fetchLibraries()
      .then((found) => {
        setLibraryIds(found.map((entry) => entry.id));
      })
      .catch(() => {
        setLibraryIds([]);
        setIsReading(false);
      });
  }, []);

  const kept = favourites.join(',');

  const read = useCallback(async () => {
    if (libraryIds.length === 0) {
      return;
    }

    setIsReading(true);

    const asked =
      kind === 'favourites'
        ? { ids: kept === '' ? [] : kept.split(','), limit: PAGE_SIZE }
        : kind === 'new'
          ? { order: 'newest' as const, limit: PAGE_SIZE }
          : { kind, limit: PAGE_SIZE };

    const pages = await Promise.all(
      libraryIds.map(async (libraryId) =>
        fetchLibraryItems(libraryId, asked).catch(() => ({ items: [], total: 0 })),
      ),
    );

    const found = pages.flatMap((entry) => entry.items);

    setItems(found);
    setIsReading(false);
    reportItems.current?.(found);
  }, [libraryIds, kind, kept]);

  useEffect(() => {
    void read();
  }, [read]);

  return (
    <motion.div
      variants={staggerVariants}
      initial="hidden"
      animate="shown"
      className="flex flex-col gap-8 px-5 pb-16 pt-24 sm:px-10"
    >
      <motion.header
        variants={revealVariants(prefersReducedMotion)}
        transition={revealTransition(prefersReducedMotion, 'heavy')}
        className="flex flex-col gap-2"
      >
        <h1 className="text-5xl font-semibold tracking-tight sm:text-7xl">{page.title}</h1>
        <p className="text-text-muted">{page.standfirst}</p>
      </motion.header>

      <motion.section
        variants={revealVariants(prefersReducedMotion)}
        transition={revealTransition(prefersReducedMotion)}
        aria-label={page.title}
        className="flex flex-col gap-5"
      >
        {isReading ? (
          <Spinner label={`Reading ${page.title.toLowerCase()}`} size="sm" />
        ) : items.length === 0 ? (
          <p className="max-w-prose text-text-muted">{page.empty}</p>
        ) : (
          <MediaGrid
            items={items}
            onPlay={onPlay}
            onInspect={onInspect}
            {...(watchedFractionFor === undefined ? {} : { watchedFractionFor })}
            {...(resumeFor === undefined ? {} : { resumeFor })}
            {...(isKept === undefined ? {} : { isKept })}
            {...(onToggleKept === undefined ? {} : { onToggleKept })}
          />
        )}
      </motion.section>
    </motion.div>
  );
};

BrowseArea.displayName = 'BrowseArea';

export { BrowseArea };
