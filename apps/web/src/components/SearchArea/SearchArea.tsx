import { Icon } from '@FluxUI/Icon';
import { Cancel01Icon, FilterHorizontalIcon, Search01Icon } from '@hugeicons/core-free-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Button } from '@FluxUI/Button';
import { TextField } from '@FluxUI/TextField';
import { Spinner } from '@FluxUI/Spinner';
import { revealVariants, revealTransition, staggerVariants } from '@FluxUI/animations/reveal';
import { CouldNotRead } from '@FluxUI/CouldNotRead';
import { useQuery } from '@tanstack/react-query';
import { libraryQueries } from '@FluxClient/query/libraryQueries';
import { collapseToShows } from '@FluxClient/library/pickFeatured';
import { MediaGrid } from '@FluxWeb/components/MediaGrid/MediaGrid';
import { GridSizeChooser } from '@FluxWeb/components/GridSizeChooser/GridSizeChooser';
import { readGridSize, saveGridSize } from '@FluxWeb/library/gridSizePreference';
import { buildFilterOptions } from './buildFilterOptions';
import { FilterChips } from './components/FilterChips/FilterChips';
import type { LibraryFacets } from '@FluxContracts/schemas/Library';
import type { SearchAreaProps, SearchKind } from './SearchArea.types';

const SETTLE_MILLISECONDS = 250;

const PAGE_SIZE = 60;

const KINDS: { id: SearchKind; label: string }[] = [
  { id: 'everything', label: 'Everything' },
  { id: 'films', label: 'Films' },
  { id: 'shows', label: 'Shows' },
];

const NO_FACETS: LibraryFacets = { genres: [], decades: [], maxRating: 0 };

const DECADE = 10;

/**
 * Reads a chip's value back as a number, since chips deal in strings and everything downstream of
 * them is arithmetic.
 *
 * @param value - The chip's value, or nothing where none is chosen.
 * @returns The number, or nothing.
 */
const asNumber = (value: string | null): number | undefined =>
  value === null ? undefined : Number(value);

/**
 * Searching the libraries, and narrowing them. A field on its own answers "what is this called", and
 * most of the time somebody is asking something looser — a kind of thing, a decade, an evening's
 * worth of something. Both are asked of the server rather than of the page, since a library is
 * longer than one page of it.
 *
 * @param search - What is in the search box.
 * @param onSearchChange - Told what was typed.
 * @param genre - The genre chosen, or nothing.
 * @param onGenreChange - Told which genre was chosen.
 * @param onPlay - Told to start something, and where from.
 * @param onInspect - Told to open the page about something.
 * @param onItemsLoaded - Told what it found, so an address naming an item can be resolved.
 * @param watchedFractionFor - How far through each item this viewer is.
 * @param resumeFor - Where they left each item.
 * @param isKept - Whether each item is kept.
 * @param onToggleKept - Told to keep something, or stop.
 */
const SearchArea = ({
  search,
  onSearchChange,
  genre,
  onGenreChange,
  onPlay,
  onInspect,
  onItemsLoaded,
  watchedFractionFor,
  resumeFor,
  isKept,
  onToggleKept,
}: SearchAreaProps) => {
  const [kind, setKind] = useState<SearchKind>('everything');
  const [decade, setDecade] = useState<string | null>(null);
  const [minRating, setMinRating] = useState<string | null>(null);
  const [minYourStars, setMinYourStars] = useState<string | null>(null);
  const [isShowingFilters, setIsShowingFilters] = useState(false);
  const [size, setSize] = useState(readGridSize);
  const prefersReducedMotion = useReducedMotion();

  const asking = useQuery(libraryQueries.facets());
  const facets = asking.data ?? NO_FACETS;

  const options = useMemo(() => buildFilterOptions(facets), [facets]);

  const reportItems = useRef(onItemsLoaded);

  reportItems.current = onItemsLoaded;

  const libraries = useQuery(libraryQueries.all());

  const libraryIds = useMemo(
    () => (libraries.data ?? []).map((entry) => entry.id),
    [libraries.data],
  );

  const asked = useMemo(() => {
    const startsAt = asNumber(decade);

    return {
      ...(search.trim() === '' ? {} : { search }),
      ...(kind === 'everything' ? {} : { kind }),
      ...(genre === null ? {} : { genre }),
      ...(startsAt === undefined ? {} : { yearFrom: startsAt, yearTo: startsAt + DECADE - 1 }),
      ...(minRating === null ? {} : { minRating: Number(minRating) }),
      ...(minYourStars === null ? {} : { minYourStars: Number(minYourStars) }),
      limit: PAGE_SIZE,
    };
  }, [search, kind, genre, decade, minRating, minYourStars]);

  const [settled, setSettled] = useState(asked);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSettled(asked);
    }, SETTLE_MILLISECONDS);

    return () => {
      clearTimeout(timer);
    };
  }, [asked]);

  const found = useQuery(libraryQueries.across(libraryIds, settled));

  const items = useMemo(() => collapseToShows(found.data ?? []), [found.data]);

  const isReading =
    libraries.isPending || (libraryIds.length > 0 && (found.isPending || asked !== settled));

  useEffect(() => {
    if (!isReading) {
      reportItems.current?.(items);
    }
  }, [items, isReading]);

  const narrowed = [decade, minRating, minYourStars].filter((chosen) => chosen !== null).length;

  const isNarrowed =
    kind !== 'everything' || genre !== null || search.trim() !== '' || narrowed > 0;

  const clearFilters = () => {
    setDecade(null);
    setMinRating(null);
  };

  return (
    <motion.div
      variants={staggerVariants}
      initial="hidden"
      animate="shown"
      exit="gone"
      className="flex flex-col gap-8 px-5 pb-16 pt-14 sm:px-10"
    >
      <motion.div
        variants={revealVariants(prefersReducedMotion)}
        transition={revealTransition(prefersReducedMotion, 'heavy')}
        className="flex flex-col gap-4"
      >
        <h1 className="text-5xl font-semibold tracking-tight sm:text-7xl">Search</h1>

        <TextField
          label="Search the library"
          isLabelHidden
          isBare
          size="xl"
          type="search"
          hasFocusOnMount
          value={search}
          placeholder="Everything you own"
          icon={<Icon of={Search01Icon} size={28} />}
          onValueChange={onSearchChange}
        />
      </motion.div>

      <motion.div
        variants={revealVariants(prefersReducedMotion)}
        transition={revealTransition(prefersReducedMotion)}
        className="flex flex-col gap-3"
      >
        <div className="flex flex-wrap items-center gap-2">
          {KINDS.map((option) => (
            <Button
              key={option.id}
              size="sm"
              isPill
              variant={option.id === kind ? 'glossy' : 'secondary'}
              onClick={() => {
                setKind(option.id);
              }}
            >
              {option.label}
            </Button>
          ))}

          <Button
            size="sm"
            isPill
            variant={isShowingFilters ? 'glossy' : 'secondary'}
            isActive={isShowingFilters}
            onClick={() => {
              setIsShowingFilters(!isShowingFilters);
            }}
          >
            <Icon of={FilterHorizontalIcon} size={16} />
            {narrowed === 0 ? 'Filters' : `Filters (${narrowed.toString()})`}
          </Button>

          {!isNarrowed ? null : (
            <Button
              variant="ghost"
              size="sm"
              isPill
              onClick={() => {
                setKind('everything');
                onGenreChange(null);
                onSearchChange('');
                clearFilters();
              }}
            >
              <Icon of={Cancel01Icon} size={16} />
              Clear
            </Button>
          )}
        </div>

        <FilterChips
          legend="Genre"
          options={options.genres}
          value={genre}
          onValueChange={onGenreChange}
        />

        <AnimatePresence initial={false}>
          {!isShowingFilters ? null : (
            <motion.div
              key="filters"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={revealTransition(prefersReducedMotion)}
              className="overflow-hidden"
            >
              <div className="flex flex-col gap-5 pt-2">
                <FilterChips
                  legend="Decade"
                  options={options.decades}
                  value={decade}
                  onValueChange={setDecade}
                />
                <FilterChips
                  legend="Rating"
                  options={options.ratings}
                  value={minRating}
                  onValueChange={setMinRating}
                />
                <FilterChips
                  legend="Your rating"
                  options={options.yourStars}
                  value={minYourStars}
                  onValueChange={setMinYourStars}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <motion.section
        variants={revealVariants(prefersReducedMotion)}
        transition={revealTransition(prefersReducedMotion)}
        aria-label="Results"
        className="flex flex-col gap-5"
      >
        <header className="flex flex-wrap items-center justify-between gap-3 text-sm text-text-muted">
          {isReading ? (
            <Spinner label="Searching" size="sm" />
          ) : (
            <span>
              {items.length === 0
                ? 'Nothing here'
                : items.length === 1
                  ? '1 result'
                  : `${items.length.toString()} results`}
            </span>
          )}

          {items.length === 0 ? null : (
            <GridSizeChooser
              value={size}
              onValueChange={(next) => {
                setSize(next);
                saveGridSize(next);
              }}
            />
          )}
        </header>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={[kind, genre, decade, minRating, minYourStars].join(':')}
            variants={staggerVariants}
            initial="hidden"
            animate="shown"
            exit="gone"
          >
            {libraries.isError || found.isError ? (
              <CouldNotRead
                what="The library"
                isTryingAgain={libraries.isFetching || found.isFetching}
                onTryAgain={() => {
                  void libraries.refetch();
                  void found.refetch();
                }}
              />
            ) : items.length === 0 && !isReading ? (
              <p className="max-w-prose text-text-muted">
                {isNarrowed
                  ? 'Nothing matches all of that. Taking one of the filters off is usually the fastest way back.'
                  : 'This library has nothing in it yet. Scanning one from the home page is where things come from.'}
              </p>
            ) : (
              <MediaGrid
                items={items}
                size={size}
                onPlay={onPlay}
                onInspect={onInspect}
                {...(watchedFractionFor === undefined ? {} : { watchedFractionFor })}
                {...(resumeFor === undefined ? {} : { resumeFor })}
                {...(isKept === undefined ? {} : { isKept })}
                {...(onToggleKept === undefined ? {} : { onToggleKept })}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </motion.section>
    </motion.div>
  );
};

SearchArea.displayName = 'SearchArea';

export { SearchArea };
