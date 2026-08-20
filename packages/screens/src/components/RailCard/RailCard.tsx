import { Icon } from '@FluxUI/Icon';
import { ArrowTurnForwardIcon, FavouriteIcon, PlayIcon } from '@hugeicons/core-free-icons';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Button } from '@FluxUI/Button';
import { MediaCard } from '@FluxUI/MediaCard';
import { Badge } from '@FluxUI/Badge';
import { liquidSpring } from '@FluxUI/animations/reveal';
import { hasFinePointer } from '@FluxUI/hasFinePointer';
import { formatDuration } from '@FluxCore/functions/formatDuration';
import { useQuery } from '@tanstack/react-query';
import { libraryQueries } from '@FluxClient/query/libraryQueries';
import { showSlug } from '@FluxCore/functions/showSlug';
import { MediaPreview } from '@FluxScreens/components/MediaPreview/MediaPreview';
import { MediaFacts } from '@FluxScreens/components/MediaFacts/MediaFacts';
import type { RailCardProps } from './RailCard.types';

const HOVER_DELAY_MILLISECONDS = 600;

const GROWTH = 1.18;

const MARGIN = 12;

const GENRE_LIMIT = 3;

type Anchor = { left: number; top: number; width: number };

/**
 * Places an opened card over the one it grew from, so it expands from where the pointer already is
 * rather than appearing somewhere else.
 *
 * @param rect - Where the resting card sits.
 * @returns Where to put the opened one.
 */
const placeOver = (rect: DOMRect): Anchor => {
  const width = rect.width * GROWTH;
  const centred = rect.left + rect.width / 2 - width / 2;
  const furthest = window.innerWidth - width - MARGIN;

  return {
    width,
    left: Math.min(Math.max(centred, MARGIN), Math.max(furthest, MARGIN)),
    top: rect.top - (rect.height * (GROWTH - 1)) / 2,
  };
};

/**
 * Moves an opened card back inside the window when expanding it would take it off an edge — the
 * cards at the ends of a row are exactly the ones a pointer reaches first.
 *
 * @param top - Where the card would go.
 * @param height - How much room there is.
 * @returns Where it should actually go.
 */
const fitInside = (top: number, height: number): number => {
  const lowest = window.innerHeight - height - MARGIN;

  return Math.max(Math.min(top, lowest), MARGIN);
};

/**
 * A card in a row that grows when a pointer rests on it, playing a preview and showing what it is
 * with the controls for starting or keeping it. Rests before opening, since a pointer crossing a
 * row should not open every card it passes.
 *
 * @param media - The item to draw.
 * @param watchedFraction - How far through it this viewer is.
 * @param onPlay - Told to start it, and where from.
 * @param onInspect - Told to open the page about it.
 * @param resumeSeconds - Where they left it.
 * @param hoverDelayMilliseconds - How long a pointer rests before it opens.
 * @param onOpenShow - Told to open the programme an episode belongs to.
 * @param isKept - Whether it is kept.
 * @param onToggleKept - Told to keep it, or stop.
 * @param isSeries - Whether this card stands for a whole programme rather than for the episode that
 *   happens to represent it, in which case the episode's own name and number are not what a reader
 *   is looking at — and pressing it opens the programme rather than that one episode.
 */
const RailCard = ({
  media,
  watchedFraction,
  onPlay,
  onInspect,
  resumeSeconds,
  hoverDelayMilliseconds = HOVER_DELAY_MILLISECONDS,
  onOpenShow,
  isKept = false,
  onToggleKept,
  isSeries = false,
}: RailCardProps) => {
  const inspect = () => {
    if (isSeries && onOpenShow !== undefined) {
      onOpenShow(media);

      return;
    }

    onInspect(media);
  };

  const holderRef = useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const prefersReducedMotion = useReducedMotion();

  const close = useCallback(() => {
    setAnchor(null);
  }, []);

  useEffect(() => {
    if (anchor === null) {
      return;
    }

    window.addEventListener('scroll', close, { capture: true, passive: true });

    return () => {
      window.removeEventListener('scroll', close, { capture: true });
    };
  }, [anchor, close]);

  const named = media.seriesId ?? showSlug(media.seriesTitle ?? '');

  const asked = useQuery({
    ...libraryQueries.detail(media.id),
    enabled: anchor !== null && !isSeries,
  });

  const asking = useQuery({
    ...libraryQueries.show(media.libraryId, named === '' ? null : named),
    enabled: anchor !== null && isSeries,
  });

  const detail = asked.data ?? null;
  const show = asking.data ?? null;

  const told = isSeries ? null : (detail?.metadata.overview ?? null);

  const genres = isSeries ? (show?.genres ?? []) : (detail?.metadata.genres ?? []);

  const panelRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const panel = panelRef.current;

    if (anchor === null || panel === null) {
      return;
    }

    const fit = () => {
      const fitted = fitInside(anchor.top, panel.offsetHeight);

      if (Math.abs(fitted - anchor.top) > 1) {
        setAnchor({ ...anchor, top: fitted });
      }
    };

    fit();

    const watcher = new ResizeObserver(fit);

    watcher.observe(panel);

    return () => {
      watcher.disconnect();
    };
  }, [anchor]);

  const open = useCallback(() => {
    const holder = holderRef.current;

    if (holder === null || prefersReducedMotion === true || !hasFinePointer()) {
      return;
    }

    setAnchor(placeOver(holder.getBoundingClientRect()));
  }, [prefersReducedMotion]);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancel = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => cancel, [cancel]);

  const artworkUrl = media.hasBackdrop
    ? `/api/media/${media.id}/image/backdrop`
    : media.hasPoster
      ? `/api/media/${media.id}/image/poster`
      : undefined;

  return (
    <div
      ref={holderRef}
      onPointerEnter={(event) => {
        if (event.pointerType !== 'mouse') {
          return;
        }

        cancel();
        timerRef.current = setTimeout(open, hoverDelayMilliseconds);
      }}
      onPointerLeave={() => {
        cancel();
      }}
    >
      <MediaCard
        {...(isSeries || media.seriesTitle === null || media.seriesTitle === undefined
          ? {}
          : { eyebrow: media.title })}
        title={media.seriesTitle ?? media.title}
        subtitle={
          <MediaFacts
            media={media}
            hasEpisode={!isSeries}
            className="flex flex-wrap items-center gap-2"
          />
        }
        shape="wide"
        {...(watchedFraction === undefined ? {} : { watchedFraction })}
        {...(artworkUrl === undefined ? {} : { imageUrl: artworkUrl })}
        onSelect={inspect}
        className="w-full"
      />

      {createPortal(
        <AnimatePresence>
          {anchor === null ? null : (
            <motion.div
              key={media.id}
              ref={panelRef}
              initial={{ opacity: 0, scale: 1 / GROWTH }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1 / GROWTH }}
              transition={liquidSpring}
              onPointerLeave={close}
              style={{
                left: anchor.left,
                top: anchor.top,
                width: anchor.width,
              }}
              className="fixed z-40 flex max-h-[calc(100svh_-_1.5rem)] flex-col overflow-hidden rounded-lg bg-surface-raised p-1.5 shadow-[0_2px_10px_rgb(0_0_0/0.4),0_40px_90px_-24px_rgb(0_0_0/0.85)] ring-1 ring-[var(--surface-line)]"
            >
              <Button
                variant="bare"
                size="none"
                aria-label={`More about ${media.seriesTitle ?? media.title}`}
                onClick={inspect}
                className="absolute inset-0 z-0 rounded-lg"
              />

              <div className="pointer-events-none aspect-video max-h-[42svh] w-full shrink-0 overflow-hidden rounded-md">
                <MediaPreview
                  mediaId={media.id}
                  backdropUrl={artworkUrl ?? null}
                  durationSeconds={media.durationSeconds}
                  settleMilliseconds={0}
                  hasSubtitles
                  fills
                />
              </div>

              <div className="flex min-h-0 w-full flex-1 flex-col gap-3 px-4 pb-4 pt-4 text-left">
                <span className="flex items-start justify-between gap-3">
                  <span className="min-w-0 text-xs uppercase tracking-[0.16em] text-text-muted">
                    {isSeries
                      ? show === null
                        ? null
                        : show.seasonCount === 1
                          ? `${show.episodeCount.toString()} episodes`
                          : `${show.seasonCount.toString()} seasons · ${show.episodeCount.toString()} episodes`
                      : media.seriesTitle === null || media.seriesTitle === undefined
                        ? null
                        : media.title}
                  </span>
                </span>

                {onOpenShow === undefined ||
                media.seriesTitle === null ||
                media.seriesTitle === undefined ? (
                  <span className="text-xl font-semibold leading-tight tracking-[-0.02em] text-text">
                    {media.seriesTitle ?? media.title}
                  </span>
                ) : (
                  <Button
                    variant="bare"
                    size="none"
                    aria-label={`About ${media.seriesTitle}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onOpenShow(media);
                    }}
                    className="relative z-10 self-start text-left text-xl font-semibold leading-tight tracking-[-0.02em] text-text underline-offset-4 hover:underline"
                  >
                    {media.seriesTitle}
                  </Button>
                )}

                <span className="pointer-events-none flex min-h-0 shrink flex-col gap-3 text-left">
                  <MediaFacts
                    media={
                      isSeries && show !== null
                        ? { ...media, rating: show.rating ?? null, year: show.year ?? null }
                        : media
                    }
                    hasEpisode={!isSeries}
                    className="flex flex-wrap items-center gap-2 text-xs font-medium tracking-[0.1em] text-text-muted"
                  />

                  {told === null || told === '' ? null : (
                    <span className="line-clamp-3 min-h-0 shrink overflow-hidden text-xs leading-relaxed text-text-muted">
                      {told}
                    </span>
                  )}

                  {genres.length === 0 ? null : (
                    <span className="flex shrink-0 flex-wrap gap-1.5">
                      {genres.slice(0, GENRE_LIMIT).map((genre) => (
                        <Badge key={genre} size="sm">
                          {genre}
                        </Badge>
                      ))}
                    </span>
                  )}
                </span>

                <span className="relative z-10 flex shrink-0 items-center gap-2 pt-1">
                  <Button
                    variant="glossy"
                    size="md"
                    isPill
                    className="flex-1"
                    onClick={(event) => {
                      event.stopPropagation();
                      onPlay(media, resumeSeconds ?? 0);
                    }}
                  >
                    <Icon of={PlayIcon} size={15} />
                    {resumeSeconds === undefined
                      ? 'Play'
                      : `Resume from ${formatDuration(resumeSeconds)}`}
                  </Button>

                  {resumeSeconds === undefined ? null : (
                    <Button
                      isIconOnly
                      variant="secondary"
                      size="md"
                      label={`Start ${media.title} again`}
                      onClick={(event) => {
                        event.stopPropagation();
                        onPlay(media, 0);
                      }}
                    >
                      <Icon of={ArrowTurnForwardIcon} size={17} />
                    </Button>
                  )}

                  {onToggleKept === undefined ? null : (
                    <Button
                      isIconOnly
                      variant="secondary"
                      size="md"
                      label={isKept ? `Stop keeping ${media.title}` : `Keep ${media.title}`}
                      isActive={isKept}
                      onClick={(event) => {
                        event.stopPropagation();
                        onToggleKept(media);
                      }}
                    >
                      {isKept ? (
                        <Icon of={FavouriteIcon} size={17} />
                      ) : (
                        <Icon of={FavouriteIcon} size={17} />
                      )}
                    </Button>
                  )}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
};

RailCard.displayName = 'RailCard';

export { RailCard };
