import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { IconInfoCircle, IconPlayerPlayFilled } from '@tabler/icons-react';
import { Button } from '@FluxUI/Button';
import { revealVariants, revealTransition, staggerVariants } from '@FluxUI/animations/reveal';
import { formatDuration } from '@FluxCore/functions/formatDuration';
import { cn } from '@FluxUI/cn';
import { MediaPreview } from '@FluxWeb/components/MediaPreview/MediaPreview';
import { MediaFacts } from '@FluxWeb/components/MediaFacts/MediaFacts';
import { PageDots } from '@FluxUI/PageDots';
import type { HeroProps } from './Hero.types';

/**
 * How much scrolling the hero holds on to before the page moves on.
 *
 * The picture stays where it is for this much of the page, drawing itself into
 * a card as it goes, and only then does the library start to come up. Somebody
 * scrolling gets the change of shape first and the change of place second,
 * rather than both at once.
 */
const DRAWS_IN_BY_PIXELS = 640;

/**
 * How much of the screen the card gives up at its foot.
 *
 * The slot the card is drawn in has to stay a whole screen tall while it
 * forms, or the page underneath moves. What is left below the finished card is
 * dead space, so the page is pulled up over exactly that much — during the
 * drawing it is under the fold and nothing sees it, and afterwards the library
 * starts at the card's own bottom edge rather than a quarter of a screen
 * beneath it.
 */
const FOOT_OF_THE_CARD = '24svh';

/**
 * How long an item holds the screen before the next one takes it.
 */
const ROTATE_AFTER_MILLISECONDS = 14_000;

/**
 * How long the hero waits before starting a preview.
 *
 * Arriving at a home page is not the same as choosing something, and a page
 * that starts transcoding the moment it loads transcodes for nobody.
 */
const PREVIEW_SETTLE_MILLISECONDS = 2500;

/**
 * Where an item's artwork is served from.
 */
const artworkUrl = (mediaId: string): string => `/api/media/${mediaId}/image/backdrop`;

const logoUrl = (mediaId: string): string => `/api/media/${mediaId}/image/logo`;

/**
 * Where the mark sits, and how much of the frame it may take.
 *
 * The far corner from the words. Everything that can be read — the episode,
 * the title, the facts, the buttons — is stacked at the bottom left, so the
 * mark went where none of it is: it says which programme this is without
 * queueing up behind the sentence that says the same thing in type.
 *
 * A logo is artwork with its own proportions — some are a word set wide, some
 * are a word stacked three lines deep inside a device — so it is given a box
 * rather than a size and told to fit whatever shape it turns out to be, capped
 * in viewport height as well as width so a tall one cannot run down the
 * picture.
 *
 * Shadowed, because it is drawn straight onto the artwork rather than onto the
 * wash at the foot of the card, and white lettering on a pale frame is
 * lettering nobody can see. Fades rather than rises: it belongs to the picture
 * behind it, which is crossfading too.
 */
const LOGO_BOX = [
  'pointer-events-none absolute right-5 top-5 z-10 sm:right-10 sm:top-8',
  'max-h-[9svh] w-auto max-w-[min(45vw,15rem)] object-contain object-right',
  'drop-shadow-[0_2px_12px_rgba(0,0,0,0.55)]',
].join(' ');

/**
 * The screen the library opens with.
 *
 * Editorial rather than catalogue: the title is set at a size a poster would
 * use and allowed to overlap the picture, the supporting detail is a thin
 * column beside it, and the composition is deliberately off centre. A frame
 * with everything neatly stacked in the middle is a frame nobody looks at
 * twice.
 *
 * Everything is sized in viewport units so a phone gets the same composition
 * rather than a squeezed version of a desktop one.
 */
const Hero = ({
  items,
  onPlay,
  onInspect,
  onPalette,
  onFeatureChange,
  resumeFor,
  rotateAfterMilliseconds = ROTATE_AFTER_MILLISECONDS,
}: HeroProps) => {
  const [index, setIndex] = useState(0);

  /**
   * The items whose lettering would not load.
   *
   * Kept per item rather than as one flag, because a hero rotates: one title
   * whose logo has gone missing from the cache must not leave every other
   * title in the rotation nameless. An item in here falls back to its name set
   * in the interface's own typeface, which is what every item did before there
   * were logos at all.
   */
  const [unlettered, setUnlettered] = useState<ReadonlySet<string>>(new Set());
  const [isHeld, setIsHeld] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  const featured = items[index % Math.max(items.length, 1)];
  const isLettered = featured?.hasLogo === true && !unlettered.has(featured.id);
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
  const corner = useTransform(scrollYProgress, [0, 1], ['0px', '28px']);

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

  const hold = useCallback(() => {
    setIsHeld(true);
  }, []);

  const release = useCallback(() => {
    setIsHeld(false);
  }, []);

  if (featured === undefined) {
    return null;
  }

  return (
    <div
      ref={runwayRef}
      className="relative"
      style={{
        height:
          prefersReducedMotion === true
            ? '100svh'
            : `calc(100svh + ${DRAWS_IN_BY_PIXELS.toString()}px)`,
        marginBottom: `-${FOOT_OF_THE_CARD}`,
      }}
    >
      <div className="sticky top-0 h-svh">
        <motion.section
          aria-label="Featured"
          onPointerEnter={hold}
          onPointerLeave={release}
          onFocusCapture={hold}
          onBlurCapture={release}
          style={
            prefersReducedMotion === true
              ? {
                  top: '72px',
                  left: '40px',
                  right: '40px',
                  bottom: FOOT_OF_THE_CARD,
                  borderRadius: '28px',
                }
              : { top: lift, left: inset, right: inset, bottom: foot, borderRadius: corner }
          }
          className={cn(
            'absolute flex flex-col justify-end overflow-hidden',
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

          {!isLettered ? null : (
            <motion.img
              key={featured.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: prefersReducedMotion === true ? 0.2 : 0.9, ease: 'easeOut' }}
              src={logoUrl(featured.id)}
              alt=""
              className={LOGO_BOX}
              onError={() => {
                setUnlettered((known) => new Set(known).add(featured.id));
              }}
            />
          )}

          <motion.div
            key={featured.id}
            variants={staggerVariants}
            initial="hidden"
            animate="shown"
            className="relative flex flex-col gap-3 px-5 pb-8 pt-24 sm:px-10"
          >
            {featured.seriesTitle === null || featured.seriesTitle === undefined ? null : (
              <motion.p
                variants={revealVariants(prefersReducedMotion)}
                transition={revealTransition(prefersReducedMotion)}
                className="text-sm font-medium uppercase tracking-[0.2em] text-text-muted"
              >
                {featured.title}
              </motion.p>
            )}

            <motion.h1
              variants={revealVariants(prefersReducedMotion)}
              transition={revealTransition(prefersReducedMotion, 'heavy')}
              className="max-w-[16ch] text-[clamp(2rem,6.5vw,5rem)] font-semibold leading-[0.95] tracking-[-0.035em] text-text"
            >
              {featured.seriesTitle ?? featured.title}
            </motion.h1>

            <motion.p
              variants={revealVariants(prefersReducedMotion)}
              transition={revealTransition(prefersReducedMotion)}
            >
              <MediaFacts
                media={featured}
                className="flex flex-wrap items-center gap-2 text-sm font-medium tracking-[0.14em] text-text-muted"
              />
            </motion.p>

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
                <IconPlayerPlayFilled size={18} aria-hidden />
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
                  <IconInfoCircle size={18} aria-hidden />
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
        </motion.section>
      </div>
    </div>
  );
};

Hero.displayName = 'Hero';

export { Hero };
