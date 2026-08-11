import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Button } from '@FluxUI/Button';
import { staggerVariants } from '@FluxUI/animations/reveal';
import { RailCard } from '@FluxWeb/components/RailCard/RailCard';
import { Spinner } from '@FluxUI/Spinner';
import { fetchLibraries, fetchLibraryItems } from '@FluxWeb/library/fetchLibrary';
import { Rail } from '@FluxUI/Rail';
import { Hero } from '@FluxWeb/components/Hero/Hero';
import { groupIntoRails } from '@FluxWeb/library/groupIntoRails';
import { pickFeatured } from '@FluxWeb/library/pickFeatured';
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
  onWatch,
}: LibraryBrowserProps) => {
  const [libraries, setLibraries] = useState<Library[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [items, setItems] = useState<MediaSummary[]>([]);
  const [total, setTotal] = useState(0);
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

  // Held in a ref rather than depended upon. A caller that passes a fresh
  // function every render — which is what an inline arrow is — would
  // otherwise make this effect run on every render, and the state it sets
  // renders again: an update loop that never settles.
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

    // Fetched once for the whole library rather than per card: a page of
    // hundreds would otherwise open hundreds of connections to draw hundreds
    // of thin bars.
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
      setTotal(page.total);
    } catch {
      setState('unreachable');
    }
  }, [selectedId, appliedSearch]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

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
      // Keyed on which of the two the browser is being, so moving between the
      // library and search plays a transition. The component itself stays
      // mounted underneath: remounting it would refetch everything and show a
      // spinner where a transition should be.
      variants={staggerVariants}
      initial="hidden"
      animate="shown"
      className="flex flex-col gap-8"
    >
      {hasHero && items.length > 0 ? (
        <Hero
          items={pickFeatured(items, HERO_COUNT)}
          onPlay={(media, startSeconds) => {
            if (onWatch === undefined) {
              onPlay(media);
            } else {
              onWatch(media, startSeconds);
            }
          }}
          resumeFor={resumeFor}
          onInspect={onPlay}
          {...(onFeatureChange === undefined ? {} : { onFeatureChange })}
          {...(onPalette === undefined ? {} : { onPalette })}
        />
      ) : null}

      <section className="flex flex-col gap-5 px-5 sm:px-10">
        <header className="flux-rail flex items-center gap-3 overflow-x-auto pb-1">
          <div className="flex shrink-0 items-center gap-2">
            {total === 0 ? null : (
              <span className="mr-1 text-sm text-text-muted">
                {total === 1 ? '1 item' : `${String(total)} items`}
              </span>
            )}

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

        {items.length === 0 ? (
          <p className="text-text-muted">
            {appliedSearch === ''
              ? 'This library is empty. Scan it to find your media.'
              : `Nothing matches “${appliedSearch}”.`}
          </p>
        ) : (
          <div className="flex flex-col gap-10">
            {groupIntoRails(items, Date.now(), progress).map((rail) => (
              <Rail key={rail.id} title={rail.title} className="px-0">
                {rail.items.map((media) => (
                  <li key={media.id} className="w-[70vw] shrink-0 snap-start sm:w-72 lg:w-80">
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
                      // Playing plays and reading opens the page. They were
                      // both wired to the same handler, so the play button on
                      // a card opened the page about the film instead of
                      // starting it.
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
                  </li>
                ))}
              </Rail>
            ))}
          </div>
        )}
      </section>
    </motion.div>
  );
};

LibraryBrowser.displayName = 'LibraryBrowser';

export { LibraryBrowser };
