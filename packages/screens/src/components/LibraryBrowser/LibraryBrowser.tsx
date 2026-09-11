import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { FolderOpenIcon } from '@hugeicons/core-free-icons';
import { Button } from '@ValenceUI/Button';
import { NothingHere } from '@ValenceUI/NothingHere';
import { staggerVariants } from '@ValenceUI/animations/reveal';
import { RailCard } from '@ValenceScreens/components/RailCard/RailCard';
import { Rail } from '@ValenceUI/Rail';
import { RevealItem } from '@ValenceUI/RevealItem';
import { SplashScreen } from '@ValenceUI/SplashScreen';
import { Spinner } from '@ValenceUI/Spinner';
import { Hero } from '@ValenceScreens/components/Hero/Hero';
import { groupIntoRails } from '@ValenceClient/library/groupIntoRails';
import { CouldNotRead } from '@ValenceUI/CouldNotRead';
import { useQuery } from '@tanstack/react-query';
import { libraryQueries } from '@ValenceClient/query/libraryQueries';
import { viewingQueries } from '@ValenceClient/query/viewingQueries';
import { pickFeatured } from '@ValenceClient/library/pickFeatured';
import { cn } from '@ValenceUI/cn';
import { EmptyLibrary } from '@ValenceScreens/components/LibraryBrowser/components/EmptyLibrary/EmptyLibrary';
import { byMediaId } from '@ValenceClient/playback/watchProgress';
import { watchedFraction } from '@ValenceContracts/schemas/WatchProgress';
import { resumeFor } from '@ValenceClient/playback/resumeFor';
import { useHomeRows } from '@ValenceScreens/components/LibraryBrowser/useHomeRows';
import type { LibraryKind } from '@ValenceContracts/schemas/Library';
import type { LibraryBrowserProps } from './LibraryBrowser.types';

const HERO_COUNT = 5;

const PAGE_SIZE = 60;

const SEARCH_DEBOUNCE_MS = 250;

const HERO_SAMPLE = 200;

const WATCHABLE: ReadonlySet<LibraryKind> = new Set(['movies', 'shows']);

/**
 * The front of the server: a hero drawn from everything on it, and the rows beneath it.
 *
 * Every library holding something to watch, together — films and programmes on one page rather than
 * one library at a time behind a switch. Choosing between them is what the bar along the top is for,
 * and a second way of choosing on the page itself was the same question asked twice. Books are left
 * to their own section, since nothing in one can be played.
 *
 * Beneath the hero it is a handful of rows rather than the library laid end to end: carrying on,
 * what somebody is likely to want, what is new, what is well thought of, and a few genres. A server
 * with six thousand films is still a page of a dozen rows; the rest is what the sections along the
 * top and search are for. Genres keep arriving as somebody scrolls, a few at a time, so the page
 * goes on for as long as there is something new to show. Searching trades the rows for the answer.
 *
 * @param search - What is in the search box.
 * @param onPlay - Told to open the page about something.
 * @param onWatch - Told to start something, and where from.
 * @param onShow - Told to open a programme rather than an episode.
 * @param onOpenShow - Told to open the programme an episode belongs to.
 * @param onItemsLoaded - Told what it drew, so an address naming an item can be resolved.
 * @param onFeatureChange - Told which item the hero is showing.
 * @param onPalette - Told the colours on screen, so the page can be lit by them.
 * @param onAddLibrary - Told to add a library, where the viewer may.
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
  onAddLibrary,
  onPlay,
  onShow,
  onWatch,
}: LibraryBrowserProps) => {
  const [appliedSearch, setAppliedSearch] = useState('');

  const askedFor = useQuery(libraryQueries.all());
  const libraries = askedFor.data ?? [];

  const watchable = useMemo(
    () => libraries.filter((entry) => WATCHABLE.has(entry.kind)).map((entry) => entry.id),
    [libraries],
  );

  const isHome = appliedSearch === '';

  const page = useQuery({
    ...libraryQueries.across(watchable, { search: appliedSearch, limit: PAGE_SIZE }),
    enabled: watchable.length > 0 && !isHome,
  });

  const items = page.data ?? [];

  const sample = useQuery(libraryQueries.across(watchable, { search: '', limit: HERO_SAMPLE }));

  const heroItems = sample.data ?? [];

  const heroPicks = useMemo(() => pickFeatured(heroItems, HERO_COUNT), [heroItems]);

  const watched = useQuery(viewingQueries.progress());
  const progress = useMemo(() => byMediaId(watched.data ?? []), [watched.data]);

  const home = useHomeRows(watchable, progress, isHome, !watched.isLoading);
  const { hasMore, isReadingMore, showMore } = home;

  const [end, setEnd] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (end === null || !isHome || !hasMore || isReadingMore) {
      return;
    }

    const watching = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting === true) {
          showMore();
        }
      },
      { rootMargin: '0px 0px 800px 0px' },
    );

    watching.observe(end);

    return () => {
      watching.disconnect();
    };
  }, [end, isHome, hasMore, isReadingMore, showMore]);

  const rails = isHome ? home.rails : groupIntoRails(items, Date.now(), progress);
  const shown = rails.flatMap((rail) => rail.items);
  const shownKey = shown.map((media) => media.id).join(',');

  const reportItems = useRef(onItemsLoaded);
  const shownRef = useRef(shown);

  reportItems.current = onItemsLoaded;
  shownRef.current = shown;

  useEffect(() => {
    if (shownRef.current.length > 0) {
      reportItems.current?.(shownRef.current);
    }
  }, [shownKey]);

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
    page.isLoading ||
    home.isReading ||
    (hasHero && watchable.length > 0 && sample.isPending);

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
      <NothingHere
        of={FolderOpenIcon}
        title="No libraries yet"
        detail={
          onAddLibrary === undefined
            ? 'Ask the server admin to add one.'
            : 'Add one to get started.'
        }
        fills
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
    );
  }

  const hasSheet = hasHero && heroItems.length > 0;

  return (
    <motion.div
      variants={staggerVariants}
      initial="hidden"
      animate="shown"
      exit="gone"
      className="flex flex-col gap-8"
    >
      {hasSheet ? (
        <Hero
          items={heroPicks}
          staysBehind
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

      <section
        {...(hasSheet ? { 'data-meets-bar': '' } : {})}
        className={cn(
          'flex flex-col gap-5 px-4 sm:px-6',
          hasSheet
            ? 'valence-sheet relative z-10 min-h-[calc(100svh-var(--nav-clearance,0px))] pb-16 pt-8'
            : '',
        )}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={appliedSearch}
            variants={staggerVariants}
            initial="hidden"
            animate="shown"
            exit="gone"
          >
            {rails.length === 0 ? (
              <EmptyLibrary
                search={appliedSearch}
                libraryName={null}
                hasContentElsewhere={heroItems.length > 0}
                canManage={onAddLibrary !== undefined}
                {...(onAddLibrary === undefined ? {} : { onManage: onAddLibrary })}
              />
            ) : (
              <div className="flex flex-col gap-10">
                {rails.map(({ showOf, ...rail }) => (
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

                {isHome && hasMore ? (
                  <div ref={setEnd} className="flex h-16 items-center justify-center">
                    {isReadingMore ? <Spinner size="sm" label="Finding more to watch" /> : null}
                  </div>
                ) : null}
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
