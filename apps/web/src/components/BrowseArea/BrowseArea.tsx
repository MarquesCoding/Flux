import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Spinner } from '@FluxUI/Spinner';
import { revealVariants, revealTransition, staggerVariants } from '@FluxUI/animations/reveal';
import { fetchLibraries, fetchLibraryItems } from '@FluxWeb/library/fetchLibrary';
import { getRealtimeClient } from '@FluxWeb/realtime/getRealtimeClient';
import { collapseToShows } from '@FluxWeb/library/pickFeatured';
import { MediaGrid } from '@FluxWeb/components/MediaGrid/MediaGrid';
import { GridSizeChooser } from '@FluxWeb/components/GridSizeChooser/GridSizeChooser';
import { readGridSize, saveGridSize } from '@FluxWeb/library/gridSizePreference';
import type { MediaSummary } from '@FluxContracts/schemas/Library';
import type { BrowseAreaProps, BrowseKind } from './BrowseArea.types';

const PAGE_SIZE = 120;

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
 * A page of the library asked one question — the films, the programmes, what arrived recently, what
 * has been kept — drawn as a grid across every library rather than one at a time.
 *
 * @param kind - Which question this page asks.
 * @param onPlay - Told to start something, and where from.
 * @param onInspect - Told to open the page about something.
 * @param onItemsLoaded - Told what it drew, so an address naming an item can be resolved.
 * @param watchedFractionFor - How far through each item this viewer is.
 * @param resumeFor - Where they left each item.
 * @param favourites - What they have kept, for the page that lists them.
 * @param isKept - Whether each item is kept.
 * @param onToggleKept - Told to keep something, or stop.
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
  const [size, setSize] = useState(readGridSize);
  const prefersReducedMotion = useReducedMotion();
  const page = PAGES[kind];

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

    const found = collapseToShows(pages.flatMap((entry) => entry.items));

    setItems(found);
    setIsReading(false);
    reportItems.current?.(found);
  }, [libraryIds, kind, kept]);

  useEffect(() => {
    void read();
  }, [read]);

  useEffect(() => {
    const client = getRealtimeClient();

    const reread = () => {
      void read();
    };

    const release = client.subscribe('media', reread);
    const stopResuming = client.onResumed(reread);

    return () => {
      release();
      stopResuming();
    };
  }, [read]);

  return (
    <motion.div
      variants={staggerVariants}
      initial="hidden"
      animate="shown"
      exit="gone"
      className="flex flex-col gap-8 px-5 pb-16 pt-24 sm:px-10"
    >
      <motion.header
        variants={revealVariants(prefersReducedMotion)}
        transition={revealTransition(prefersReducedMotion, 'heavy')}
        className="flex flex-col gap-2"
      >
        <h1 className="text-5xl font-semibold tracking-tight sm:text-7xl">{page.title}</h1>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-text-muted">{page.standfirst}</p>

          {isReading || items.length === 0 ? null : (
            <GridSizeChooser
              value={size}
              onValueChange={(next) => {
                setSize(next);
                saveGridSize(next);
              }}
            />
          )}
        </div>
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
            size={size}
            isSeries={kind === 'shows'}
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
