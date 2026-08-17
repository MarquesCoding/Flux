import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  RiClockwiseLine,
  RiHeartFill,
  RiHeartLine,
  RiInformationLine,
  RiPlayFill,
} from '@remixicon/react';
import { Button } from '@FluxUI/Button';
import { MediaCard } from '@FluxUI/MediaCard';
import { Badge } from '@FluxUI/Badge';
import { liquidSpring } from '@FluxUI/animations/reveal';
import { hasFinePointer } from '@FluxUI/hasFinePointer';
import { formatDuration } from '@FluxCore/functions/formatDuration';
import { fetchMediaDetail } from '@FluxWeb/library/fetchLibrary';
import { MediaPreview } from '@FluxWeb/components/MediaPreview/MediaPreview';
import { MediaFacts } from '@FluxWeb/components/MediaFacts/MediaFacts';
import type { MediaDetail } from '@FluxContracts/schemas/Library';
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
}: RailCardProps) => {
  const [detail, setDetail] = useState<MediaDetail | null>(null);
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

  useEffect(() => {
    if (anchor === null || detail !== null) {
      return;
    }

    let abandoned = false;

    void fetchMediaDetail(media.id).then((found) => {
      if (!abandoned) {
        setDetail(found);
      }
    });

    return () => {
      abandoned = true;
    };
  }, [anchor, detail, media.id]);

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
        {...(media.seriesTitle === null || media.seriesTitle === undefined
          ? {}
          : { eyebrow: media.title })}
        title={media.seriesTitle ?? media.title}
        subtitle={<MediaFacts media={media} className="flex flex-wrap items-center gap-2" />}
        shape="wide"
        {...(watchedFraction === undefined ? {} : { watchedFraction })}
        {...(artworkUrl === undefined ? {} : { imageUrl: artworkUrl })}
        onSelect={() => {
          onInspect(media);
        }}
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
              <div className="aspect-video max-h-[42svh] w-full shrink-0 overflow-hidden rounded-md">
                <MediaPreview
                  mediaId={media.id}
                  backdropUrl={artworkUrl ?? null}
                  durationSeconds={media.durationSeconds}
                  settleMilliseconds={0}
                  fills
                />
              </div>

              <div className="flex min-h-0 w-full flex-1 flex-col gap-3 px-4 pb-4 pt-4 text-left">
                <span className="flex items-start justify-between gap-3">
                  <span className="min-w-0 text-xs uppercase tracking-[0.16em] text-text-muted">
                    {media.seriesTitle === null || media.seriesTitle === undefined
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
                    className="text-left text-xl font-semibold leading-tight tracking-[-0.02em] text-text underline-offset-4 hover:underline"
                  >
                    {media.seriesTitle}
                  </Button>
                )}

                <Button
                  variant="bare"
                  size="none"
                  aria-label={`About ${media.title}`}
                  onClick={() => {
                    onInspect(media);
                  }}
                  className="flex min-h-0 shrink flex-col gap-3 text-left"
                >
                  <MediaFacts
                    media={media}
                    className="flex flex-wrap items-center gap-2 text-xs font-medium tracking-[0.1em] text-text-muted"
                  />

                  {detail?.metadata.overview === undefined ||
                  detail.metadata.overview === null ||
                  detail.metadata.overview === '' ? null : (
                    <span className="line-clamp-3 min-h-0 shrink overflow-hidden text-xs leading-relaxed text-text-muted">
                      {detail.metadata.overview}
                    </span>
                  )}

                  {(detail?.metadata.genres ?? []).length === 0 ? null : (
                    <span className="flex shrink-0 flex-wrap gap-1.5">
                      {(detail?.metadata.genres ?? []).slice(0, GENRE_LIMIT).map((genre) => (
                        <Badge key={genre} size="sm">
                          {genre}
                        </Badge>
                      ))}
                    </span>
                  )}
                </Button>

                <span className="flex shrink-0 items-center gap-2 pt-1">
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
                    <RiPlayFill size={15} aria-hidden />
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
                      <RiClockwiseLine size={17} aria-hidden />
                    </Button>
                  )}

                  <Button
                    isIconOnly
                    variant="secondary"
                    size="md"
                    label={`More about ${media.title}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onInspect(media);
                    }}
                  >
                    <RiInformationLine size={17} aria-hidden />
                  </Button>

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
                        <RiHeartFill size={17} aria-hidden />
                      ) : (
                        <RiHeartLine size={17} aria-hidden />
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
