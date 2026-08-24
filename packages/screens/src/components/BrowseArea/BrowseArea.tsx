import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Spinner } from '@ValenceUI/Spinner';
import { revealVariants, revealTransition, staggerVariants } from '@ValenceUI/animations/reveal';
import { CouldNotRead } from '@ValenceUI/CouldNotRead';
import { useQuery } from '@tanstack/react-query';
import {
  FilmSlateIcon,
  FireIcon,
  FolderOpenIcon,
  HeartIcon,
  TelevisionIcon,
} from '@phosphor-icons/react';
import { Button } from '@ValenceUI/Button';
import { NothingHere } from '@ValenceUI/NothingHere';
import { libraryQueries } from '@ValenceClient/query/libraryQueries';
import { collapseToShows } from '@ValenceClient/library/pickFeatured';
import { MediaGrid } from '@ValenceScreens/components/MediaGrid/MediaGrid';
import { GridSizeChooser } from '@ValenceScreens/components/GridSizeChooser/GridSizeChooser';
import { readGridSize, saveGridSize } from '@ValenceScreens/library/gridSizePreference';
import type { Icon as PhosphorIcon } from '@phosphor-icons/react';
import type { BrowseAreaProps, BrowseKind } from './BrowseArea.types';

const PAGE_SIZE = 120;

const PAGES: Record<
  BrowseKind,
  { title: string; standfirst: string; empty: string; of: PhosphorIcon }
> = {
  shows: {
    title: 'Shows',
    standfirst: 'Everything that comes in episodes.',
    empty: 'No shows yet',
    of: TelevisionIcon,
  },
  films: {
    title: 'Films',
    standfirst: 'Everything that stands on its own.',
    empty: 'No films yet',
    of: FilmSlateIcon,
  },
  new: {
    title: 'New & Popular',
    standfirst: 'The most recent arrivals, newest first.',
    empty: 'Nothing new yet',
    of: FireIcon,
  },
  favourites: {
    title: 'Favourites',
    standfirst: 'Everything you have kept.',
    empty: 'Nothing has been favourited yet',
    of: HeartIcon,
  },
};

/**
 * A page of the library asked one question — the films, the programmes, what arrived recently, what
 * has been kept — drawn as a grid across every library rather than one at a time.
 *
 * @param kind - Which question this page asks.
 * @param onOpenShow - Told to open a programme, for a page whose cards stand for programmes.
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
  onOpenShow,
  onPlay,
  onInspect,
  onItemsLoaded,
  watchedFractionFor,
  resumeFor,
  favourites = [],
  isKept,
  onToggleKept,
  onAddLibrary,
}: BrowseAreaProps) => {
  const [size, setSize] = useState(readGridSize);
  const prefersReducedMotion = useReducedMotion();
  const page = PAGES[kind];

  const reportItems = useRef(onItemsLoaded);

  reportItems.current = onItemsLoaded;

  const libraries = useQuery(libraryQueries.all());

  const hasNoLibraries = libraries.data !== undefined && libraries.data.length === 0;

  const libraryIds = useMemo(
    () => (libraries.data ?? []).map((entry) => entry.id),
    [libraries.data],
  );

  const kept = favourites.join(',');

  const asked =
    kind === 'favourites'
      ? { ids: kept === '' ? [] : kept.split(','), limit: PAGE_SIZE }
      : kind === 'new'
        ? { order: 'newest' as const, limit: PAGE_SIZE }
        : { kind, limit: PAGE_SIZE };

  const found = useQuery(libraryQueries.across(libraryIds, asked));

  const items = useMemo(() => collapseToShows(found.data ?? []), [found.data]);

  const isReading = libraries.isPending || (libraryIds.length > 0 && found.isPending);

  useEffect(() => {
    if (!isReading) {
      reportItems.current?.(items);
    }
  }, [items, isReading]);

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
        {libraries.isError || found.isError ? (
          <CouldNotRead
            what={page.title}
            isTryingAgain={libraries.isFetching || found.isFetching}
            onTryAgain={() => {
              void libraries.refetch();
              void found.refetch();
            }}
          />
        ) : isReading ? (
          <Spinner label={`Reading ${page.title.toLowerCase()}`} size="sm" />
        ) : items.length === 0 ? (
          hasNoLibraries ? (
            <NothingHere
              of={FolderOpenIcon}
              title="No libraries yet"
              detail={
                onAddLibrary === undefined
                  ? 'Ask the server admin to add one.'
                  : 'Add one to get started.'
              }
              {...(onAddLibrary === undefined
                ? {}
                : {
                    action: (
                      <Button variant="glossy" isPill onClick={onAddLibrary}>
                        Add a library
                      </Button>
                    ),
                  })}
            />
          ) : (
            <NothingHere
              of={page.of}
              title={page.empty}
              detail={
                onAddLibrary === undefined
                  ? 'Ask the server admin to scan one.'
                  : 'Scan a library, or add files to its folder.'
              }
              {...(onAddLibrary === undefined
                ? {}
                : {
                    action: (
                      <Button variant="glossy" isPill onClick={onAddLibrary}>
                        Scan a library
                      </Button>
                    ),
                  })}
            />
          )
        ) : (
          <MediaGrid
            items={items}
            size={size}
            isSeries={kind === 'shows'}
            {...(onOpenShow === undefined ? {} : { onOpenShow })}
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
