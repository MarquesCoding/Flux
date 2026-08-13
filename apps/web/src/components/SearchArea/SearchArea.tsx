import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { IconSearch, IconX } from '@tabler/icons-react';
import { Button } from '@FluxUI/Button';
import { TextField } from '@FluxUI/TextField';
import { Spinner } from '@FluxUI/Spinner';
import { revealVariants, revealTransition, staggerVariants } from '@FluxUI/animations/reveal';
import { fetchGenres } from '@FluxWeb/library/fetchGenres';
import { fetchLibraries, fetchLibraryItems } from '@FluxWeb/library/fetchLibrary';
import { MediaGrid } from '@FluxWeb/components/MediaGrid/MediaGrid';
import { GridSizeChooser } from '@FluxWeb/components/GridSizeChooser/GridSizeChooser';
import { readGridSize, saveGridSize } from '@FluxWeb/library/gridSizePreference';
import type { MediaSummary } from '@FluxContracts/schemas/Library';
import type { SearchAreaProps, SearchKind } from './SearchArea.types';

/**
 * How long to wait after a keystroke before asking the server.
 *
 * Long enough that typing a word is one request rather than five, short enough
 * that stopping to think brings the results with it.
 */
const SETTLE_MILLISECONDS = 250;

/**
 * How many results to hold at once.
 */
const PAGE_SIZE = 60;

const KINDS: { id: SearchKind; label: string }[] = [
  { id: 'everything', label: 'Everything' },
  { id: 'films', label: 'Films' },
  { id: 'shows', label: 'Shows' },
];

/**
 * Searching the library, and narrowing it.
 *
 * A field on its own answers "what is this called"; most of the time somebody
 * is asking something looser than that — a kind of thing, or a mood, or an
 * evening's worth of something. The filters are that question, and they are
 * asked of the server rather than of the page: a library is longer than one
 * page of it, and sifting what happened to arrive would answer with whatever
 * the first sixty items were.
 *
 * Genres are drawn from what is actually in the library rather than from a
 * fixed list, because a list offering "Western" to somebody who owns no
 * westerns is a list of dead ends.
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
  const [total, setTotal] = useState(0);
  const [kind, setKind] = useState<SearchKind>('everything');
  const [genres, setGenres] = useState<string[]>([]);
  const [isReading, setIsReading] = useState(false);
  const [size, setSize] = useState(readGridSize);
  const prefersReducedMotion = useReducedMotion();

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

    const pages = await Promise.all(
      libraryIds.map(async (libraryId) =>
        fetchLibraryItems(libraryId, {
          ...(search.trim() === '' ? {} : { search }),
          ...(kind === 'everything' ? {} : { kind }),
          ...(genre === null ? {} : { genre }),
          limit: PAGE_SIZE,
        }).catch(() => ({ items: [], total: 0 })),
      ),
    );

    const found = pages.flatMap((page) => page.items);

    setItems(found);
    setTotal(pages.reduce((count, page) => count + page.total, 0));
    setIsReading(false);
    reportItems.current?.(found);
  }, [libraryIds, search, kind, genre]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void read();
    }, SETTLE_MILLISECONDS);

    return () => {
      clearTimeout(timer);
    };
  }, [read]);

  useEffect(() => {
    void fetchGenres().then(setGenres);
  }, []);

  const isNarrowed = kind !== 'everything' || genre !== null || search.trim() !== '';

  return (
    <motion.div
      variants={staggerVariants}
      initial="hidden"
      animate="shown"
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
          icon={<IconSearch size={28} aria-hidden />}
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

          {!isNarrowed ? null : (
            <Button
              variant="ghost"
              size="sm"
              isPill
              onClick={() => {
                setKind('everything');
                onGenreChange(null);
                onSearchChange('');
              }}
            >
              <IconX size={16} aria-hidden />
              Clear
            </Button>
          )}
        </div>

        {genres.length === 0 ? null : (
          <ul className="flux-rail flex flex-wrap gap-2">
            {genres.map((named) => (
              <li key={named}>
                <Button
                  size="sm"
                  isPill
                  variant={named === genre ? 'glossy' : 'ghost'}
                  onClick={() => {
                    onGenreChange(named === genre ? null : named);
                  }}
                >
                  {named}
                </Button>
              </li>
            ))}
          </ul>
        )}
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
              {total === 0 ? 'Nothing here' : total === 1 ? '1 item' : `${total.toString()} items`}
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
      </motion.section>
    </motion.div>
  );
};

SearchArea.displayName = 'SearchArea';

export { SearchArea };
