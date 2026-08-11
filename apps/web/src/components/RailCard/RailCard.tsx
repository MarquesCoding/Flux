import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion,
} from 'motion/react';
import {
  IconHeart,
  IconHeartFilled,
  IconInfoCircle,
  IconPlayerPlayFilled,
} from '@tabler/icons-react';
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

/**
 * How long a pointer rests before a card opens.
 */
const HOVER_DELAY_MILLISECONDS = 600;

/**
 * How much larger the open card is than the one it grew from.
 */
const GROWTH = 1.35;

/**
 * How far from the edge of the window the open card must stay.
 */
const MARGIN = 12;

/**
 * How many genres are worth naming on a card.
 */
const GENRE_LIMIT = 3;

/**
 * How far the open card leans towards the pointer, in degrees.
 *
 * Small on purpose. Enough that the panel feels like an object being looked
 * at rather than a picture stuck to the glass, and not so much that reading it
 * means fighting perspective.
 */
const TILT = 7;

/**
 * How the lean settles.
 *
 * Soft and slow to arrive, so the panel follows the pointer rather than
 * tracking it exactly — a card that mirrors every twitch reads as nervous.
 */
const LEAN = { stiffness: 150, damping: 18, mass: 0.6 } as const;

/**
 * Where a card is on screen.
 */
type Anchor = { left: number; top: number; width: number };

/**
 * Places the open card over the one it grew from.
 *
 * Kept inside the window on both sides, because the first and last cards of a
 * row are exactly the ones whose expansion would otherwise fall off screen.
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
 * Moves an opened card back inside the window.
 *
 * The panel is taller than the card it grew from — that is the point of it —
 * and a row near the foot of the screen grows straight past the bottom edge,
 * where the description and the buttons are simply not there. Measured after
 * it is drawn, because how tall it is depends on how much is known about the
 * item.
 */
const fitInside = (top: number, height: number): number => {
  const lowest = window.innerHeight - height - MARGIN;

  return Math.max(Math.min(top, lowest), MARGIN);
};

/**
 * A card in a row that opens when a pointer rests on it.
 *
 * The open card is drawn in a portal at the position of the card it grew
 * from, rather than inside the row. A row scrolls horizontally, which means it
 * clips anything growing out of it — the portal is what lets a card become
 * larger than the thing containing it.
 *
 * It shows what the item actually looks like, moving and silent, along with
 * the two things anyone wants from a card they have stopped on: play it, or
 * find out more. Nothing opens on a touch screen, where a hover is just the
 * beginning of a scroll, or under a reduced-motion preference.
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
  const towardsX = useMotionValue(0);
  const towardsY = useMotionValue(0);
  const leanX = useSpring(towardsX, LEAN);
  const leanY = useSpring(towardsY, LEAN);
  const rotateY = useTransform(leanX, (along) => along * TILT);
  const rotateX = useTransform(leanY, (down) => down * -TILT);
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
        towardsX.set(0);
        towardsY.set(0);
      }}
      onPointerMove={(event) => {
        const holder = holderRef.current;

        if (holder === null || prefersReducedMotion === true) {
          return;
        }

        const box = holder.getBoundingClientRect();

        towardsX.set((event.clientX - box.left) / box.width - 0.5);
        towardsY.set((event.clientY - box.top) / box.height - 0.5);
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
                transformPerspective: 900,
                rotateX,
                rotateY,
              }}
              className="fixed z-40 flex max-h-[calc(100svh_-_1.5rem)] flex-col overflow-hidden rounded-2xl bg-surface-raised shadow-[0_2px_10px_rgb(0_0_0/0.4),0_40px_90px_-24px_rgb(0_0_0/0.85)] ring-1 ring-white/10"
            >
              <div className="aspect-video max-h-[42svh] w-full shrink-0 overflow-hidden">
                <MediaPreview
                  mediaId={media.id}
                  backdropUrl={artworkUrl ?? null}
                  durationSeconds={media.durationSeconds}
                  settleMilliseconds={0}
                  fills
                />
              </div>

              <div className="flex min-h-0 w-full flex-1 flex-col gap-3 p-4 text-left">
                <span className="flex items-start justify-between gap-3">
                  <span className="min-w-0 text-xs uppercase tracking-[0.16em] text-text-muted">
                    {media.seriesTitle === null || media.seriesTitle === undefined
                      ? null
                      : media.title}
                  </span>

                  {(detail?.metadata.genres ?? []).length === 0 ? null : (
                    <span className="flex shrink-0 flex-wrap justify-end gap-1.5">
                      {(detail?.metadata.genres ?? []).slice(0, GENRE_LIMIT).map((genre) => (
                        <Badge key={genre} size="sm">
                          {genre}
                        </Badge>
                      ))}
                    </span>
                  )}
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
                </Button>

                <span className="flex shrink-0 flex-wrap items-center gap-2 pt-1">
                  <Button
                    variant="glossy"
                    size="sm"
                    isPill
                    onClick={(event) => {
                      event.stopPropagation();
                      onPlay(media, resumeSeconds ?? 0);
                    }}
                  >
                    <IconPlayerPlayFilled size={16} aria-hidden />
                    {resumeSeconds === undefined
                      ? 'Play'
                      : `Resume from ${formatDuration(resumeSeconds)}`}
                  </Button>

                  <Button
                    variant="secondary"
                    size="sm"
                    isPill
                    onClick={(event) => {
                      event.stopPropagation();
                      onInspect(media);
                    }}
                  >
                    <IconInfoCircle size={16} aria-hidden />
                    More info
                  </Button>

                  {onToggleKept === undefined ? null : (
                    <Button
                      isIconOnly
                      variant="ghost"
                      label={isKept ? `Stop keeping ${media.title}` : `Keep ${media.title}`}
                      isActive={isKept}
                      onClick={(event) => {
                        event.stopPropagation();
                        onToggleKept(media);
                      }}
                    >
                      {isKept ? (
                        <IconHeartFilled size={18} aria-hidden />
                      ) : (
                        <IconHeart size={18} aria-hidden />
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
