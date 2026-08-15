import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { RiCloseLine, RiEqualizerLine, RiSearchLine } from '@remixicon/react';
import { Button } from '@FluxUI/Button';
import { TextField } from '@FluxUI/TextField';
import { Spinner } from '@FluxUI/Spinner';
import { revealVariants, revealTransition, staggerVariants } from '@FluxUI/animations/reveal';
import { fetchFacets } from '@FluxWeb/library/fetchFacets';
import { fetchLibraries, fetchLibraryItems } from '@FluxWeb/library/fetchLibrary';
import { collapseToShows } from '@FluxWeb/library/pickFeatured';
import { MediaGrid } from '@FluxWeb/components/MediaGrid/MediaGrid';
import { GridSizeChooser } from '@FluxWeb/components/GridSizeChooser/GridSizeChooser';
import { readGridSize, saveGridSize } from '@FluxWeb/library/gridSizePreference';
import { buildFilterOptions } from './buildFilterOptions';
import { FilterChips } from './components/FilterChips/FilterChips';
import type { LibraryFacets, MediaSummary } from '@FluxContracts/schemas/Library';
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
 * Reads a chip's value back as a number, or nothing.
 */
const asNumber = (value: string | null): number | undefined =>
  value === null ? undefined : Number(value);

/**
 * Searching the library, and narrowing it.
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
  const [libraryIds, setLibraryIds] = useState<string[]>([]);
  const [items, setItems] = useState<MediaSummary[]>([]);
  const [kind, setKind] = useState<SearchKind>('everything');
  const [facets, setFacets] = useState<LibraryFacets>(NO_FACETS);
  const [decade, setDecade] = useState<string | null>(null);
  const [minRating, setMinRating] = useState<string | null>(null);
  const [isShowingFilters, setIsShowingFilters] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [size, setSize] = useState(readGridSize);
  const prefersReducedMotion = useReducedMotion();

  const options = useMemo(() => buildFilterOptions(facets), [facets]);

  const reportItems = useRef(onItemsLoaded);

  reportItems.current = onItemsLoaded;

  useEffect(() => {
    void fetchLibraries().then((found) => {
      setLibraryIds(found.map((entry) => entry.id));
    });
  }, []);

  const read = useCallback(async () => {
    if (libraryIds.length === 0) {
      return;
    }

    setIsReading(true);

    const startsAt = asNumber(decade);

    const pages = await Promise.all(
      libraryIds.map(async (libraryId) =>
        fetchLibraryItems(libraryId, {
          ...(search.trim() === '' ? {} : { search }),
          ...(kind === 'everything' ? {} : { kind }),
          ...(genre === null ? {} : { genre }),
          ...(startsAt === undefined ? {} : { yearFrom: startsAt, yearTo: startsAt + DECADE - 1 }),
          ...(minRating === null ? {} : { minRating: Number(minRating) }),
          limit: PAGE_SIZE,
        }).catch(() => ({ items: [], total: 0 })),
      ),
    );

    const found = collapseToShows(pages.flatMap((page) => page.items));

    setItems(found);
    setIsReading(false);
    reportItems.current?.(found);
  }, [libraryIds, search, kind, genre, decade, minRating]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void read();
    }, SETTLE_MILLISECONDS);

    return () => {
      clearTimeout(timer);
    };
  }, [read]);

  useEffect(() => {
    void fetchFacets().then(setFacets);
  }, []);

  const narrowed = [decade, minRating].filter((chosen) => chosen !== null).length;

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
          icon={<RiSearchLine size={28} aria-hidden />}
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
            <RiEqualizerLine size={16} aria-hidden />
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
              <RiCloseLine size={16} aria-hidden />
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
            key={[kind, genre, decade, minRating].join(':')}
            variants={staggerVariants}
            initial="hidden"
            animate="shown"
            exit="gone"
          >
            {items.length === 0 && !isReading ? (
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
