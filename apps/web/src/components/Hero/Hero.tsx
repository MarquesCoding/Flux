import { Icon } from '@FluxUI/Icon';
import { ArrowDown01Icon, InformationCircleIcon, PlayIcon } from '@hugeicons/core-free-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { Button } from '@FluxUI/Button';
import { revealVariants, revealTransition, staggerVariants } from '@FluxUI/animations/reveal';
import { formatDuration } from '@FluxCore/functions/formatDuration';
import { cn } from '@FluxUI/cn';
import { useQuery } from '@tanstack/react-query';
import { libraryQueries } from '@FluxWeb/query/libraryQueries';
import { MediaPreview } from '@FluxWeb/components/MediaPreview/MediaPreview';
import { MediaFacts } from '@FluxWeb/components/MediaFacts/MediaFacts';
import { PageDots } from '@FluxUI/PageDots';
import type { HeroProps } from './Hero.types';

const DRAWS_IN_BY_PIXELS = 640;

const FOOT_OF_THE_CARD = '24svh';

const ROTATE_AFTER_MILLISECONDS = 14_000;

const PREVIEW_SETTLE_MILLISECONDS = 2500;

/**
 * Builds the address an item's backdrop is served from, which is what the hero is drawn over.
 *
 * @param mediaId - The item.
 * @returns The address to load.
 */
const artworkUrl = (mediaId: string): string => `/api/media/${mediaId}/image/backdrop`;

/**
 * Builds the address a title's logo is served from — the title as its designer set it, which the
 * hero prefers to text where the catalogue has one.
 *
 * @param mediaId - The item.
 * @returns The address to load.
 */
const logoUrl = (mediaId: string): string => `/api/media/${mediaId}/image/logo`;

const SYNOPSIS_MILLISECONDS = 8000;

const SYNOPSIS_FOLDED = { opacity: 0, height: 0, marginTop: '-0.75rem' } as const;

const LOGO_BOX = [
  'max-h-[14svh] w-auto max-w-[min(70vw,24rem)] object-contain object-left',
  'drop-shadow-[0_2px_12px_rgba(0,0,0,0.55)]',
].join(' ');

/**
 * The screen a library opens with: one thing filling the window, its own artwork behind it, playing
 * a preview once it has settled. Rotates through a handful of items rather than showing one, and
 * hands out the colours it is showing so the whole page can be lit by them.
 *
 * @param items - What it may feature.
 * @param onPlay - Told to start something, and where from.
 * @param onInspect - Told to open the page about something.
 * @param onPalette - Told the colours on screen, so the page can be lit by them.
 * @param onFeatureChange - Told which item is showing now.
 * @param resumeFor - Where this viewer left each item, for the button that offers to carry on.
 * @param rotateAfterMilliseconds - How long each item holds the screen.
 * @param fills - Whether it fills what it is put in rather than standing in a runway of its own.
 *   A hero standing in a runway says there is more underneath, with a mark that fades as soon as
 *   somebody starts scrolling — it has said its piece by then, and a hint that outstays the moment
 *   it was needed becomes decoration. One that fills has nothing beneath it and says nothing.
 *
 *   The mark stands clear of whatever the shell has put along the bottom, which it learns from the
 *   shell rather than assuming: a screen with a dock says how much room it takes, and a screen with
 *   no dock — a shared link, which has no chrome at all — says nothing and the mark sits low.
 *   A library's front page scrolls beneath it, which is what the runway and the card drawing in are
 *   for; a page holding nothing but this has nothing to scroll, and the card would be drawing in
 *   against a scroll that never comes.
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
}: HeroProps) => {
  const [index, setIndex] = useState(0);

  const [unlettered, setUnlettered] = useState<ReadonlySet<string>>(new Set());
  const [isTelling, setIsTelling] = useState(true);
  const [isPointedAt, setIsPointedAt] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const isHeld = isPointedAt || isFocused;
  const prefersReducedMotion = useReducedMotion();

  const featured = items[index % Math.max(items.length, 1)];
  const isLettered = featured?.hasLogo === true && !unlettered.has(featured.id);

  const asked = useQuery(libraryQueries.detail(featured?.id ?? null));

  const overview = asked.data?.metadata.overview ?? null;
  const told = overview === '' ? null : overview;
  const resume = featured === undefined ? null : (resumeFor?.(featured.id) ?? null);

  useEffect(() => {
    if (featured !== undefined) {
      onFeatureChange?.(featured);
    }
  }, [featured, onFeatureChange]);

  const runwayRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: runwayRef,
    offset: ['start start', 'end end'],
  });

  const inset = useTransform(scrollYProgress, [0, 1], ['0px', '40px']);
  const lift = useTransform(scrollYProgress, [0, 1], ['0px', '72px']);
  const foot = useTransform(scrollYProgress, [0, 1], ['0px', FOOT_OF_THE_CARD]);
  const corner = useTransform(scrollYProgress, [0, 1], ['0px', '10px']);
  const beckon = useTransform(scrollYProgress, [0, 0.12], [1, 0]);

  const showNext = useCallback(() => {
    if (items.length > 1 && !isHeld) {
      setIndex((current) => (current + 1) % items.length);
    }
  }, [items.length, isHeld]);

  useEffect(() => {
    if (items.length < 2 || rotateAfterMilliseconds <= 0 || isHeld) {
      return;
    }

    const timer = setTimeout(showNext, rotateAfterMilliseconds);

    return () => {
      clearTimeout(timer);
    };
  }, [items.length, rotateAfterMilliseconds, isHeld, index, showNext]);

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
      ref={runwayRef}
      className="pointer-events-none relative"
      style={
        fills
          ? { height: '100svh' }
          : {
              height:
                prefersReducedMotion === true
                  ? '100svh'
                  : `calc(100svh + ${DRAWS_IN_BY_PIXELS.toString()}px)`,
              marginBottom: `-${FOOT_OF_THE_CARD}`,
            }
      }
    >
      <div className={cn('h-svh', fills ? '' : 'sticky top-0')}>
        <motion.section
          aria-label="Featured"
          onPointerEnter={hold}
          onPointerLeave={release}
          onFocusCapture={() => {
            setIsFocused(true);
          }}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) {
              setIsFocused(false);
            }
          }}
          style={
            fills
              ? { top: 0, left: 0, right: 0, bottom: 0, borderRadius: 0 }
              : prefersReducedMotion === true
                ? {
                    top: '72px',
                    left: '40px',
                    right: '40px',
                    bottom: FOOT_OF_THE_CARD,
                    borderRadius: '10px',
                  }
                : { top: lift, left: inset, right: inset, bottom: foot, borderRadius: corner }
          }
          className={cn(
            'pointer-events-auto absolute flex flex-col justify-end overflow-hidden',
            'ring-1 ring-white/10 shadow-[0_40px_80px_-40px_rgba(0,0,0,0.9)]',
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
                onEnded={showNext}
                {...(onPalette === undefined ? {} : { onPalette })}
                fills
              />
            </motion.div>
          </AnimatePresence>

          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-surface via-surface/60 to-transparent" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-surface/85 via-transparent to-transparent" />

          <motion.div
            key={featured.id}
            variants={staggerVariants}
            initial="hidden"
            animate="shown"
            className="relative flex flex-col gap-3 px-5 pb-8 pt-24 sm:px-10"
          >
            <motion.h1
              variants={revealVariants(prefersReducedMotion)}
              transition={revealTransition(prefersReducedMotion, 'heavy')}
              className={
                isLettered
                  ? 'flex'
                  : 'max-w-[16ch] text-[clamp(2rem,6.5vw,5rem)] font-semibold leading-[0.95] tracking-[-0.035em] text-text'
              }
            >
              {isLettered ? (
                <img
                  src={logoUrl(featured.id)}
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
                className="flex flex-wrap items-center gap-2 text-sm font-medium tracking-[0.14em] text-text-muted"
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
                  className="line-clamp-3 max-w-[52ch] overflow-hidden text-[0.95rem] leading-relaxed text-text/90 drop-shadow-[0_1px_8px_rgba(0,0,0,0.7)]"
                >
                  {told}
                </motion.p>
              )}
            </AnimatePresence>

            <motion.div
              variants={revealVariants(prefersReducedMotion)}
              transition={revealTransition(prefersReducedMotion)}
              className="flex flex-wrap items-center gap-3 pt-2"
            >
              <Button
                variant="glossy"
                size="lg"
                isPill
                onClick={() => {
                  onPlay(featured, resume ?? 0);
                }}
              >
                <Icon of={PlayIcon} size={18} />
                {resume === null ? 'Play' : `Resume from ${formatDuration(resume)}`}
              </Button>

              {onInspect === undefined ? null : (
                <Button
                  variant="secondary"
                  size="lg"
                  isPill
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
            onSelect={setIndex}
            {...(items.length > 1 && rotateAfterMilliseconds > 0
              ? { fillMilliseconds: rotateAfterMilliseconds, isFillPaused: isHeld }
              : {})}
            className="mb-8 mr-5 self-end sm:absolute sm:bottom-8 sm:right-10 sm:mb-0 sm:mr-0"
          />

          {fills ? null : (
            <motion.span
              aria-hidden
              style={{ opacity: beckon }}
              animate={prefersReducedMotion === true ? {} : { y: [0, 6, 0] }}
              transition={
                prefersReducedMotion === true
                  ? {}
                  : { duration: 2, repeat: Infinity, ease: 'easeInOut' }
              }
              className="pointer-events-none absolute bottom-[calc(2rem+var(--dock-clearance,0px))] left-1/2 -translate-x-1/2 text-text-muted"
            >
              <Icon of={ArrowDown01Icon} size={24} />
            </motion.span>
          )}
        </motion.section>
      </div>
    </div>
  );
};

Hero.displayName = 'Hero';

export { Hero };
