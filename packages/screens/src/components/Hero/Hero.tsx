import { Icon } from '@ValenceUI/Icon';
import { titleLogoUrl } from '@ValenceScreens/library/titleLogoUrl';
import { TitleLogo } from '@ValenceScreens/components/TitleLogo/TitleLogo';
import { InformationCircleIcon, PlayIcon } from '@hugeicons/core-free-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AnimatePresence,
  motion,
  useAnimationFrame,
  useMotionValue,
  useReducedMotionConfig,
  useScroll,
  useTransform,
} from 'motion/react';
import { Button } from '@ValenceUI/Button';
import { revealVariants, revealTransition, staggerVariants } from '@ValenceUI/animations/reveal';
import { formatDuration } from '@ValenceCore/functions/formatDuration';
import { cn } from '@ValenceUI/cn';
import { useQuery } from '@tanstack/react-query';
import { libraryQueries } from '@ValenceClient/query/libraryQueries';
import { MediaPreview } from '@ValenceScreens/components/MediaPreview/MediaPreview';
import { MediaFacts } from '@ValenceScreens/components/MediaFacts/MediaFacts';
import { PageDots } from '@ValenceUI/PageDots';
import { useIsPageCovered } from '@ValenceUI/useIsPageCovered';
import type { HeroProps } from './Hero.types';

const ROTATE_AFTER_MILLISECONDS = 28_000;

const PREVIEW_SETTLE_MILLISECONDS = 2500;

const SYNOPSIS_MILLISECONDS = 8000;

const SYNOPSIS_FOLDED = { opacity: 0, height: 0, marginTop: '-0.75rem' } as const;

const SETTLES_TO = 0.92;

const FADES_TO = 0.08;

const DRIFTS_BY = -40;

const UNMEASURED_DEPTH = 600;

const LOGO_BOX = [
  'max-h-[22svh] w-auto max-w-[min(76vw,36rem)] object-contain object-left',
  'drop-shadow-[var(--shadow-legible)]',
].join(' ');

/**
 * Builds the address an item's backdrop is served from, which is what the hero is drawn over.
 *
 * @param mediaId - The item.
 * @returns The address to load.
 */
const artworkUrl = (mediaId: string): string => `/api/media/${mediaId}/image/backdrop`;

/**
 * The screen a library opens with: one thing in a card beneath the bar, its own artwork behind it,
 * playing a preview once it has settled. Rotates through a handful of items rather than showing one,
 * and hands out the colours it is showing so the whole page can be lit by them.
 *
 * Where it stays behind, it holds its place as the page is scrolled and the rows ride up over it,
 * and recedes as they cover it: fading, settling back a little, and drifting up more slowly than
 * the page — so it reads as further away rather than as something being scrolled off the top.
 *
 * How far it has receded is measured against the page's own scroll and the card's height, not
 * against the card's position. A card held in place by the page reports a position that moves with
 * the scroll, so measuring from it would read as never having moved at all. That needs whatever follows it to be opaque, which is why it
 * is asked for rather than assumed: a page whose next thing is transparent would scroll its text
 * straight across the picture.
 *
 * @param items - What it may feature.
 * @param onPlay - Told to start something, and where from.
 * @param onInspect - Told to open the page about something.
 * @param onPalette - Told the colours on screen, so the page can be lit by them.
 * @param onFeatureChange - Told which item is showing now.
 * @param resumeFor - Where this viewer left each item, for the button that offers to carry on.
 * @param rotateAfterMilliseconds - How long each item holds the screen.
 * @param fills - Whether it fills what it is put in, edge to edge, rather than standing as a card.
 *   A page holding nothing but this has no page for a card to sit on.
 * @param staysBehind - Whether it holds still while the page scrolls up over it.
 */
const Hero = ({
  items,
  onPlay,
  onInspect,
  onPalette,
  onFeatureChange,
  resumeFor,
  rotateAfterMilliseconds = ROTATE_AFTER_MILLISECONDS,
  fills = false,
  staysBehind = false,
}: HeroProps) => {
  const [index, setIndex] = useState(0);
  const turn = useMotionValue(0);

  const [unlettered, setUnlettered] = useState<ReadonlySet<string>>(new Set());
  const [isTelling, setIsTelling] = useState(true);
  const [isPointedAt, setIsPointedAt] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const isCovered = useIsPageCovered();
  const isHeld = isPointedAt || isFocused || isCovered;
  const prefersReducedMotion = useReducedMotionConfig();

  const featured = items[index % Math.max(items.length, 1)];
  const isLettered = featured?.hasLogo === true && !unlettered.has(featured.id);

  const asked = useQuery(libraryQueries.detail(featured?.id ?? null));

  const overview = asked.data?.metadata.overview ?? null;
  const told = overview === '' ? null : overview;
  const resume = featured === undefined ? null : (resumeFor?.(featured.id) ?? null);

  const isReceding = staysBehind && !fills && prefersReducedMotion !== true;

  const cardRef = useRef<HTMLElement>(null);
  const depthRef = useRef(UNMEASURED_DEPTH);
  const { scrollY } = useScroll();

  const covered = useTransform(scrollY, (travelled) =>
    Math.min(Math.max(travelled / depthRef.current, 0), 1),
  );

  const scale = useTransform(covered, [0, 1], [1, SETTLES_TO]);
  const opacity = useTransform(covered, [0, 1], [1, FADES_TO]);
  const y = useTransform(covered, [0, 1], [0, DRIFTS_BY]);

  useEffect(() => {
    const card = cardRef.current;

    if (card === null || !isReceding) {
      return;
    }

    const measure = new ResizeObserver(() => {
      depthRef.current = Math.max(card.offsetHeight, 1);
    });

    measure.observe(card);

    return () => {
      measure.disconnect();
    };
  }, [isReceding]);

  useEffect(() => {
    if (featured !== undefined) {
      onFeatureChange?.(featured);
    }
  }, [featured, onFeatureChange]);

  const isRotating = items.length > 1 && rotateAfterMilliseconds > 0;

  const [isPreviewPaused, setIsPreviewPaused] = useState(false);

  const showNext = useCallback(() => {
    if (items.length > 1 && !isHeld) {
      setIndex((current) => (current + 1) % items.length);
    }
  }, [items.length, isHeld]);

  const show = useCallback(
    (next: number) => {
      turn.set(0);
      setIndex(next);
    },
    [turn],
  );

  useEffect(() => {
    turn.set(0);
  }, [index, turn]);

  useAnimationFrame((_, delta) => {
    if (!isRotating || isHeld || isPreviewPaused) {
      return;
    }

    const next = turn.get() + delta / rotateAfterMilliseconds;

    if (next < 1) {
      turn.set(next);

      return;
    }

    turn.set(0);
    showNext();
  });

  const featuredId = featured?.id ?? null;

  useEffect(() => {
    setIsTelling(true);

    const timer = setTimeout(() => {
      setIsTelling(false);
    }, SYNOPSIS_MILLISECONDS);

    return () => {
      clearTimeout(timer);
    };
  }, [featuredId]);

  const hold = useCallback(() => {
    setIsPointedAt(true);
  }, []);

  const release = useCallback(() => {
    setIsPointedAt(false);
  }, []);

  if (featured === undefined) {
    return null;
  }

  return (
    <div
      className={cn(
        fills ? 'h-[calc(100svh-var(--valence-window-bar))]' : 'px-4 pt-4 sm:px-6',
        staysBehind && !fills ? 'sticky top-[var(--nav-clearance,1rem)] z-0' : '',
      )}
    >
      <motion.section
        ref={cardRef}
        aria-label="Featured"
        onFocusCapture={(event) => {
          setIsFocused(event.target.matches(':focus-visible'));
        }}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setIsFocused(false);
          }
        }}
        {...(isReceding ? { style: { scale, opacity, y } } : {})}
        className={cn(
          'relative flex flex-col justify-end overflow-hidden',
          fills
            ? 'h-full'
            : 'h-[min(74svh,52rem)] min-h-[26rem] rounded-[20px] ring-1 ring-line shadow-[var(--shadow-cast)]',
        )}
      >
        <AnimatePresence initial={false} mode="popLayout">
          <motion.div
            key={featured.id}
            initial={{ opacity: 0, scale: prefersReducedMotion === true ? 1 : 1.06 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: prefersReducedMotion === true ? 0.2 : 1.1, ease: 'easeOut' }}
            className="absolute inset-0"
          >
            <MediaPreview
              mediaId={featured.id}
              backdropUrl={featured.hasBackdrop ? artworkUrl(featured.id) : null}
              durationSeconds={featured.durationSeconds}
              settleMilliseconds={PREVIEW_SETTLE_MILLISECONDS}
              restsOnPause
              onPlayingChange={(playing) => {
                setIsPreviewPaused(!playing);
              }}
              onEnded={showNext}
              {...(onPalette === undefined ? {} : { onPalette })}
              hasSound
              controlsAtTop
              isHeld={isCovered}
              fills
            />
          </motion.div>
        </AnimatePresence>

        <div className="valence-artwork-scrim pointer-events-none absolute inset-0" />

        <motion.div
          key={featured.id}
          variants={staggerVariants}
          initial="hidden"
          animate="shown"
          onPointerEnter={hold}
          onPointerLeave={release}
          className="relative flex flex-col gap-4 self-start px-6 pb-10 pt-24 sm:px-12 sm:pb-14"
        >
          <motion.h1
            variants={revealVariants(prefersReducedMotion)}
            transition={revealTransition(prefersReducedMotion, 'heavy')}
            className={
              isLettered
                ? 'flex'
                : 'max-w-[16ch] text-[clamp(2.75rem,6.5vw,6.5rem)] font-semibold leading-[0.95] tracking-[-0.035em] text-on-scrim'
            }
          >
            {isLettered ? (
              <TitleLogo
                src={titleLogoUrl(featured.id)}
                alt={featured.seriesTitle ?? featured.title}
                className={LOGO_BOX}
                onError={() => {
                  setUnlettered((known) => new Set(known).add(featured.id));
                }}
              />
            ) : (
              (featured.seriesTitle ?? featured.title)
            )}
          </motion.h1>

          <motion.p
            variants={revealVariants(prefersReducedMotion)}
            transition={revealTransition(prefersReducedMotion)}
          >
            <MediaFacts
              media={featured}
              hasEpisode={false}
              className="flex flex-wrap items-center gap-2 text-base font-medium text-on-scrim/85"
            />
          </motion.p>

          <AnimatePresence initial={false}>
            {told === null || !isTelling ? null : (
              <motion.p
                initial={SYNOPSIS_FOLDED}
                animate={{ opacity: 1, height: 'auto', marginTop: 0 }}
                exit={SYNOPSIS_FOLDED}
                transition={{
                  duration: prefersReducedMotion === true ? 0.2 : 0.55,
                  ease: [0.2, 0, 0, 1],
                }}
                className="line-clamp-3 max-w-[56ch] overflow-hidden text-lg leading-relaxed text-on-scrim/90 drop-shadow-[var(--shadow-legible-tight)]"
              >
                {told}
              </motion.p>
            )}
          </AnimatePresence>

          <motion.div
            variants={revealVariants(prefersReducedMotion)}
            transition={revealTransition(prefersReducedMotion)}
            className="flex flex-wrap items-center gap-3 pt-3"
          >
            <Button
              variant="glossy"
              size="xl"
              onClick={() => {
                onPlay(featured, resume ?? 0);
              }}
            >
              <Icon of={PlayIcon} size={18} />
              {resume === null ? 'Play' : `Resume from ${formatDuration(resume)}`}
            </Button>

            {onInspect === undefined ? null : (
              <Button
                variant="bare"
                size="xl"
                className="inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-md border border-on-scrim/25 text-on-scrim hover:bg-on-scrim/10"
                onClick={() => {
                  onInspect(featured);
                }}
              >
                <Icon of={InformationCircleIcon} size={18} />
                More info
              </Button>
            )}
          </motion.div>
        </motion.div>

        <PageDots
          count={items.length}
          selectedIndex={index}
          labels={items.map((item) => item.title)}
          label="Featured items"
          tone="overlay"
          onSelect={show}
          {...(isRotating ? { progress: turn } : {})}
          className="mb-8 mr-6 self-end sm:absolute sm:bottom-14 sm:right-12 sm:mb-0 sm:mr-0"
        />
      </motion.section>
    </div>
  );
};

Hero.displayName = 'Hero';

export { Hero };
