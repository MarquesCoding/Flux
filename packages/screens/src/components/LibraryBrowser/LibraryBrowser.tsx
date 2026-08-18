import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Button } from '@FluxUI/Button';
import { staggerVariants } from '@FluxUI/animations/reveal';
import { RailCard } from '@FluxScreens/components/RailCard/RailCard';
import { Rail } from '@FluxUI/Rail';
import { RevealItem } from '@FluxUI/RevealItem';
import { SplashScreen } from '@FluxUI/SplashScreen';
import { Hero } from '@FluxScreens/components/Hero/Hero';
import { groupIntoRails } from '@FluxClient/library/groupIntoRails';
import { CouldNotRead } from '@FluxUI/CouldNotRead';
import { useQuery } from '@tanstack/react-query';
import { libraryQueries } from '@FluxClient/query/libraryQueries';
import { viewingQueries } from '@FluxClient/query/viewingQueries';
import { pickFeatured } from '@FluxClient/library/pickFeatured';
import { EmptyLibrary } from '@FluxScreens/components/LibraryBrowser/components/EmptyLibrary/EmptyLibrary';
import { byMediaId } from '@FluxClient/playback/watchProgress';
import { watchedFraction } from '@FluxContracts/schemas/WatchProgress';
import { resumeFor } from '@FluxClient/playback/resumeFor';
import type { LibraryBrowserProps } from './LibraryBrowser.types';

const HERO_COUNT = 5;
const PAGE_SIZE = 60;
const SEARCH_DEBOUNCE_MS = 250;

const HERO_SAMPLE = 24;

/**
 * Browses one library: the hero at the top, the rows beneath it, and the names of the other
 * libraries across the middle. The hero draws from every library rather than the chosen one, since
 * the front of the server should show what is on it rather than what is in one folder of it.
 *
 * @param search - What is in the search box.
 * @param libraryId - Which library to show, where the address names one.
 * @param onLibraryChange - Told which library is being shown, including the one opened on.
 * @param onPlay - Told to open the page about something.
 * @param onWatch - Told to start something, and where from.
 * @param onShow - Told to open a programme rather than an episode.
 * @param onOpenShow - Told to open the programme an episode belongs to.
 * @param onItemsLoaded - Told what it drew, so an address naming an item can be resolved.
 * @param onFeatureChange - Told which item the hero is showing.
 * @param onPalette - Told the colours on screen, so the page can be lit by them.
 * @param onSearchChange - Told what was typed.
 * @param hasHero - Whether to open with a hero at all.
 * @param name - What this instance is called, for the wordmark held up while it reads.
 * @param isKept - Whether each item is kept.
 * @param onToggleKept - Told to keep something, or stop.
 */
const LibraryBrowser = ({
  search = '',
  hasHero = false,
  name,
  onFeatureChange,
  onPalette,
  onItemsLoaded,
  onOpenShow,
  isKept,
  onToggleKept,
  onPlay,
  onShow,
  onWatch,
  libraryId,
  onLibraryChange,
}: LibraryBrowserProps) => {
  const [appliedSearch, setAppliedSearch] = useState('');
  const [chosen, setChosen] = useState<string | null>(null);

  const askedFor = useQuery(libraryQueries.all());
  const libraries = askedFor.data ?? [];

  const selectedId =
    libraries.find((entry) => entry.id === libraryId)?.id ??
    libraries.find((entry) => entry.id === chosen)?.id ??
    libraries[0]?.id ??
    null;

  const page = useQuery(
    libraryQueries.items(selectedId, { search: appliedSearch, limit: PAGE_SIZE }),
  );

  const items = page.data?.items ?? [];
  const loadedFor = page.data?.libraryId ?? null;

  const sample = useQuery(
    libraryQueries.across(
      libraries.map((entry) => entry.id),
      { search: '', limit: HERO_SAMPLE },
    ),
  );

  const heroItems = sample.data ?? [];

  const watched = useQuery(viewingQueries.progress());
  const progress = byMediaId(watched.data ?? []);

  const reportItems = useRef(onItemsLoaded);

  reportItems.current = onItemsLoaded;

  const reportLibrary = useRef(onLibraryChange);

  reportLibrary.current = onLibraryChange;

  useEffect(() => {
    if (items.length > 0) {
      reportItems.current?.(items);
    }
  }, [items]);

  useEffect(() => {
    if (selectedId !== null) {
      reportLibrary.current?.(selectedId);
    }
  }, [selectedId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAppliedSearch(search);
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [search]);

  const isReading =
    askedFor.isPending ||
    (selectedId !== null && page.isPending) ||
    (hasHero && libraries.length > 0 && sample.isPending);

  if (askedFor.isError || page.isError) {
    return (
      <CouldNotRead
        what="Your library"
        isTryingAgain={askedFor.isFetching || page.isFetching}
        onTryAgain={() => {
          void askedFor.refetch();
          void page.refetch();
        }}
      />
    );
  }

  if (isReading) {
    return <SplashScreen {...(name === undefined ? {} : { name })} label="Reading your library" />;
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
          resumeFor={(mediaId) => resumeFor(progress, mediaId)}
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
                  setChosen(entry.id);
                  onLibraryChange?.(entry.id);
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
                          {...(resumeFor(progress, media.id) === null
                            ? {}
                            : { resumeSeconds: Math.floor(resumeFor(progress, media.id) ?? 0) })}
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
