import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Button } from '@FluxUI/Button';
import { staggerVariants } from '@FluxUI/animations/reveal';
import { RailCard } from '@FluxWeb/components/RailCard/RailCard';
import { Spinner } from '@FluxUI/Spinner';
import { fetchLibraries, fetchLibraryItems } from '@FluxWeb/library/fetchLibrary';
import { Rail } from '@FluxUI/Rail';
import { RevealItem } from '@FluxUI/RevealItem';
import { Hero } from '@FluxWeb/components/Hero/Hero';
import { groupIntoRails } from '@FluxWeb/library/groupIntoRails';
import { pickFeatured } from '@FluxWeb/library/pickFeatured';
import { EmptyLibrary } from '@FluxWeb/components/LibraryBrowser/components/EmptyLibrary/EmptyLibrary';
import { fetchWatchProgress, byMediaId } from '@FluxWeb/playback/watchProgress';
import { watchedFraction, isWorthResuming } from '@FluxContracts/schemas/WatchProgress';
import type { Library, MediaSummary } from '@FluxContracts/schemas/Library';
import type { WatchProgress } from '@FluxContracts/schemas/WatchProgress';
import type { BrowserState, LibraryBrowserProps } from './LibraryBrowser.types';

/**
 * How many items the hero rotates between.
 *
 * A handful: a carousel of thirty is a carousel nobody reaches the end of.
 */
const HERO_COUNT = 5;
const PAGE_SIZE = 60;
const SEARCH_DEBOUNCE_MS = 250;

/**
 * How many items are read from each library to choose the hero from.
 *
 * Enough to find a few different programmes in each, and far short of a page:
 * this runs once per library on load, and the hero only needs candidates
 * rather than a catalogue.
 */
const HERO_SAMPLE = 24;

/**
 * Browses a library.
 *
 * Search is debounced and served by the database rather than filtered in the
 * browser: the client only ever holds one page, so filtering here would search
 * the page rather than the library and quietly lie about the results.
 */
const LibraryBrowser = ({
  search = '',
  hasHero = false,
  onFeatureChange,
  onPalette,
  onItemsLoaded,
  onOpenShow,
  isKept,
  onToggleKept,
  onPlay,
  onShow,
  onWatch,
}: LibraryBrowserProps) => {
  const [libraries, setLibraries] = useState<Library[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [items, setItems] = useState<MediaSummary[]>([]);
  /**
   * Which library the held items actually came from.
   *
   * `selectedId` changes the moment somebody presses a name; the items follow
   * a request later. Anything that describes what is on screen has to use
   * this rather than the selection, or it describes a library whose contents
   * have not arrived — which is how an empty state came to announce that a
   * library of seventy-three films had nothing in it, right up until they
   * appeared.
   */
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  /**
   * What the hero may choose from, drawn from every library at once.
   *
   * Held apart from `items` rather than derived from it, because `items` is
   * one library filtered by whatever is in the search box, and the hero is
   * neither of those things. It is the front of the whole server: switching
   * to a library of documentaries should not replace it, and typing in the
   * search box should not empty it.
   *
   * Filled by asking every library for a sample at once. One request each
   * rather than a single call, because no endpoint reads across them — and a
   * library that fails to answer drops out rather than emptying the hero,
   * since a hero missing one library's films is worth more than no hero.
   */
  const [heroItems, setHeroItems] = useState<MediaSummary[]>([]);
  const [appliedSearch, setAppliedSearch] = useState('');
  const [progress, setProgress] = useState(new Map<string, WatchProgress>());

  /**
   * Where this viewer left something, when it is worth coming back to.
   */
  const resumeFor = (mediaId: string): number | null => {
    const found = progress.get(mediaId);

    return found !== undefined && isWorthResuming(found) ? found.positionSeconds : null;
  };
  const [state, setState] = useState<BrowserState>('loading');

  const reportItems = useRef(onItemsLoaded);

  reportItems.current = onItemsLoaded;

  useEffect(() => {
    if (items.length > 0) {
      reportItems.current?.(items);
    }
  }, [items]);

  useEffect(() => {
    let abandoned = false;

    fetchLibraries()
      .then((found) => {
        if (abandoned) {
          return;
        }

        setLibraries(found);
        setSelectedId(found[0]?.id ?? null);
        setState('ready');
      })
      .catch(() => {
        if (!abandoned) {
          setState('unreachable');
        }
      });

    return () => {
      abandoned = true;
    };
  }, []);

  useEffect(() => {
    let abandoned = false;

    void fetchWatchProgress().then((found) => {
      if (!abandoned) {
        setProgress(byMediaId(found));
      }
    });

    return () => {
      abandoned = true;
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAppliedSearch(search);
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [search]);

  const loadItems = useCallback(async () => {
    if (selectedId === null) {
      return;
    }

    try {
      const page = await fetchLibraryItems(selectedId, {
        search: appliedSearch,
        limit: PAGE_SIZE,
      });

      setItems(page.items);
      setLoadedFor(selectedId);
    } catch {
      setState('unreachable');
    }
  }, [selectedId, appliedSearch]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  useEffect(() => {
    if (libraries.length === 0) {
      setHeroItems([]);

      return;
    }

    let abandoned = false;

    void Promise.all(
      libraries.map((entry) =>
        fetchLibraryItems(entry.id, { search: '', limit: HERO_SAMPLE })
          .then((page) => page.items)
          .catch(() => []),
      ),
    ).then((pages) => {
      if (!abandoned) {
        setHeroItems(pages.flat());
      }
    });

    return () => {
      abandoned = true;
    };
  }, [libraries]);

  if (state === 'loading') {
    return (
      <div className="flex justify-center p-12">
        <Spinner label="Reading your library" size="lg" />
      </div>
    );
  }

  if (state === 'unreachable') {
    return (
      <p role="alert" className="text-sm text-danger">
        Your library could not be loaded. Check that the server is running and reload.
      </p>
    );
  }

  if (libraries.length === 0) {
    return (
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium text-text">No libraries yet</h2>
        <p className="text-text-muted">
          Add a library pointing at a folder of media, then scan it to see your films here.
        </p>
      </section>
    );
  }

  return (
    <motion.div
      variants={staggerVariants}
      initial="hidden"
      animate="shown"
      exit="gone"
      className="flex flex-col gap-8"
    >
      {hasHero && heroItems.length > 0 ? (
        <Hero
          items={pickFeatured(heroItems, HERO_COUNT)}
          onPlay={(media, startSeconds) => {
            if (onWatch === undefined) {
              onPlay(media);
            } else {
              onWatch(media, startSeconds);
            }
          }}
          resumeFor={resumeFor}
          onInspect={(media) => {
            if (media.seriesId !== null && onShow !== undefined) {
              onShow(media.seriesId);

              return;
            }

            onPlay(media);
          }}
          {...(onFeatureChange === undefined ? {} : { onFeatureChange })}
          {...(onPalette === undefined ? {} : { onPalette })}
        />
      ) : null}

      <section className="flex flex-col gap-5 px-5 sm:px-10">
        <header className="flux-rail flex items-center gap-3 overflow-x-auto pb-1">
          <div className="flex shrink-0 items-center gap-2">
            {libraries.map((entry) => (
              <Button
                key={entry.id}
                size="sm"
                isPill
                variant={entry.id === selectedId ? 'glossy' : 'secondary'}
                onClick={() => {
                  setSelectedId(entry.id);
                }}
              >
                {entry.name}
              </Button>
            ))}
          </div>
        </header>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={loadedFor ?? 'nothing-loaded'}
            variants={staggerVariants}
            initial="hidden"
            animate="shown"
            exit="gone"
          >
            {items.length === 0 ? (
              <EmptyLibrary
                search={appliedSearch}
                libraryName={libraries.find((entry) => entry.id === loadedFor)?.name ?? null}
                hasContentElsewhere={heroItems.length > 0}
              />
            ) : (
              <div className="flex flex-col gap-10">
                {groupIntoRails(items, Date.now(), progress).map(({ showOf, ...rail }) => (
                  <Rail
                    key={rail.id}
                    title={rail.title}
                    className="px-0"
                    {...(showOf === undefined || onOpenShow === undefined
                      ? {}
                      : {
                          onOpenTitle: () => {
                            onOpenShow(showOf);
                          },
                        })}
                  >
                    {rail.items.map((media, at) => (
                      <RevealItem
                        key={media.id}
                        index={at}
                        className="w-[70vw] shrink-0 snap-start sm:w-72 lg:w-80"
                      >
                        <RailCard
                          media={media}
                          {...(progress.has(media.id)
                            ? {
                                watchedFraction: watchedFraction(
                                  progress.get(media.id) ?? {
                                    mediaId: media.id,
                                    positionSeconds: 0,
                                    durationSeconds: media.durationSeconds,
                                    isFinished: false,
                                    updatedAt: media.addedAt,
                                  },
                                ),
                              }
                            : {})}
                          {...(resumeFor(media.id) === null
                            ? {}
                            : { resumeSeconds: Math.floor(resumeFor(media.id) ?? 0) })}
                          onPlay={(media, startSeconds) => {
                            if (onWatch === undefined) {
                              onPlay(media);

                              return;
                            }

                            onWatch(media, startSeconds);
                          }}
                          onInspect={onPlay}
                          {...(onOpenShow === undefined ? {} : { onOpenShow })}
                          {...(isKept === undefined ? {} : { isKept: isKept(media.id) })}
                          {...(onToggleKept === undefined ? {} : { onToggleKept })}
                        />
                      </RevealItem>
                    ))}
                  </Rail>
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </section>
    </motion.div>
  );
};

LibraryBrowser.displayName = 'LibraryBrowser';

export { LibraryBrowser };
