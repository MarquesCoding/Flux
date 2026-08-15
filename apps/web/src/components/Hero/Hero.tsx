import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { RiInformationLine, RiPlayFill } from '@remixicon/react';
import { Button } from '@FluxUI/Button';
import { revealVariants, revealTransition, staggerVariants } from '@FluxUI/animations/reveal';
import { formatDuration } from '@FluxCore/functions/formatDuration';
import { cn } from '@FluxUI/cn';
import { fetchMediaDetail } from '@FluxWeb/library/fetchLibrary';
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
 *
 * This is why the runway takes no pointer events. The library is pulled up
 * inside the runway's box, and the runway is positioned while the library is
 * not — so it paints over the very content it made room for, whatever the
 * order in the markup. Left as it was, everything in this much of the library
 * was unclickable, with no cursor and no hover to say why. The card puts the
 * pointer back for itself, since it has buttons of its own.
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
 * How much of the frame the mark may take.
 *
 * It is the title rather than a badge beside it: where a programme has
 * lettering of its own, that lettering is its name and setting the name again
 * underneath in the interface's typeface says the same thing twice in two
 * voices. It still stands in a heading and still carries the name as its
 * alternative text, so anything reading the page rather than looking at it
 * finds the title exactly where it expects to.
 *
 * Sized to sit where a heading sits rather than to fill the card. A mark given
 * the whole frame reads as a splash screen; this reads as a title.
 *
 * A logo is artwork with its own proportions — some are a word set wide, some
 * are a word stacked three lines deep inside a device — so it is given a box
 * rather than a size and told to fit whatever shape it turns out to be, capped
 * in viewport height as well as width so a tall one cannot run down the
 * picture.
 *
 * Shadowed, because a frame can be pale where the wash is thin, and white
 * lettering on a pale frame is lettering nobody can see.
 */
/**
 * How long the synopsis stays before it goes.
 *
 * Long enough to read three lines without hurrying, and short enough that it
 * is gone before the picture underneath it has been covered up for any length
 * of time. It leaves rather than staying because the frame is the point of a
 * hero: the words say what this is, and once they have said it they are
 * standing in front of the thing they were describing.
 */
const SYNOPSIS_MILLISECONDS = 8000;

/**
 * The synopsis with no room taken up.
 *
 * Height as well as opacity, because a paragraph that only fades leaves its
 * space behind until the instant it unmounts, and then everything resting on
 * it drops by three lines in one frame. Folding the height away carries the
 * buttons and the mark down with it instead.
 *
 * The negative margin cancels the column's own gap. A child of a flex column
 * still earns its gap at zero height, so without this the fold stops three
 * quarters of a rem short and finishes with a snap after all.
 */
const SYNOPSIS_FOLDED = { opacity: 0, height: 0, marginTop: '-0.75rem' } as const;

const LOGO_BOX = [
  'max-h-[14svh] w-auto max-w-[min(70vw,24rem)] object-contain object-left',
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

  /**
   * What this item is about, once the server has been asked.
   *
   * Held against the item it describes rather than on its own, so a synopsis
   * that arrives after the hero has moved on is not shown under the wrong
   * picture. Read here rather than carried on every card in the library: a
   * page of eighty items would be eighty overviews sent to draw one.
   */
  const [synopsis, setSynopsis] = useState<{ mediaId: string; text: string } | null>(null);
  const [isTelling, setIsTelling] = useState(true);
  /**
   * Whether a pointer is resting on the hero, and whether anything in it holds
   * focus.
   *
   * Two flags rather than one, because they are set and cleared by different
   * events and one boolean cannot tell whose turn it is to clear it. Focus
   * moving into the hero — pressing Play, tabbing to More info — set it, and
   * nothing set it back while the focus stayed there. The countdown stopped
   * and never restarted, so the marker sat empty for as long as the page was
   * open.
   */
  const [isPointedAt, setIsPointedAt] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const isHeld = isPointedAt || isFocused;
  const prefersReducedMotion = useReducedMotion();

  const featured = items[index % Math.max(items.length, 1)];
  const isLettered = featured?.hasLogo === true && !unlettered.has(featured.id);
  const told = synopsis?.mediaId === featured?.id ? (synopsis?.text ?? null) : null;
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

  const featuredId = featured?.id ?? null;

  useEffect(() => {
    if (featuredId === null) {
      return;
    }

    let abandoned = false;

    void fetchMediaDetail(featuredId).then((found) => {
      const overview = found?.metadata.overview ?? null;

      if (!abandoned && overview !== null && overview !== '') {
        setSynopsis({ mediaId: featuredId, text: overview });
      }
    });

    return () => {
      abandoned = true;
    };
  }, [featuredId]);

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
          onFocusCapture={() => {
            setIsFocused(true);
          }}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) {
              setIsFocused(false);
            }
          }}
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
                <RiPlayFill size={18} aria-hidden />
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
                  <RiInformationLine size={18} aria-hidden />
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
