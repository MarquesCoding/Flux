import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { IconInfoCircle, IconPlayerPlayFilled, IconStar } from '@tabler/icons-react'
import ButtonModule from '@FluxUI/Button'
import revealModule from '@FluxUI/animations/reveal'
import formatDurationModule from '@FluxCore/functions/formatDuration'
import cnModule from '@FluxUI/cn'
import MediaPreviewModule from '@FluxWeb/components/MediaPreview/MediaPreview'
import type { HeroProps } from './Hero.types'

const { Button } = ButtonModule
const { revealVariants, revealTransition, staggerVariants } = revealModule
const { formatDuration } = formatDurationModule
const { MediaPreview } = MediaPreviewModule
const { cn } = cnModule

/**
 * How much scrolling the hero holds on to before the page moves on.
 *
 * The picture stays where it is for this much of the page, drawing itself into
 * a card as it goes, and only then does the library start to come up. Somebody
 * scrolling gets the change of shape first and the change of place second,
 * rather than both at once.
 */
const DRAWS_IN_BY_PIXELS = 320

/**
 * How long an item holds the screen before the next one takes it.
 */
const ROTATE_AFTER_MILLISECONDS = 14_000

/**
 * How long the hero waits before starting a preview.
 *
 * Arriving at a home page is not the same as choosing something, and a page
 * that starts transcoding the moment it loads transcodes for nobody.
 */
const PREVIEW_SETTLE_MILLISECONDS = 2500

/**
 * Where an item's artwork is served from.
 */
const artworkUrl = (mediaId: string): string => `/api/media/${mediaId}/image/backdrop`

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
  onFeatureChange,
  resumeFor,
  rotateAfterMilliseconds = ROTATE_AFTER_MILLISECONDS,
}: HeroProps) => {
  const [index, setIndex] = useState(0)
  const [isHeld, setIsHeld] = useState(false)
  const prefersReducedMotion = useReducedMotion()

  const featured = items[index % Math.max(items.length, 1)]
  const resume = featured === undefined ? null : (resumeFor?.(featured.id) ?? null)
  const rating = featured?.rating ?? null

  useEffect(() => {
    if (featured !== undefined) {
      onFeatureChange?.(featured)
    }
  }, [featured, onFeatureChange])

  // Said in one voice and in one order, so the line can be built from
  // whatever is actually known about this item rather than from four
  // conditionals in the middle of the markup.
  const facts: { key: string; said: ReactNode }[] = [
    ...(typeof featured?.episodeNumber === 'number'
      ? [{ key: 'episode', said: <span className="tabular-nums">EP{featured.episodeNumber}</span> }]
      : []),
    ...(typeof featured?.seasonNumber === 'number'
      ? [{ key: 'season', said: <span className="tabular-nums">S{featured.seasonNumber}</span> }]
      : []),
    ...(rating === null
      ? []
      : [
          {
            key: 'rating',
            said: (
              <span className="flex items-center gap-1.5 tabular-nums">
                <IconStar size={14} aria-hidden />
                {rating.toFixed(1)}
              </span>
            ),
          },
        ]),
    ...(featured?.year === null || featured?.year === undefined
      ? []
      : [{ key: 'year', said: <span className="tabular-nums">{featured.year}</span> }]),
  ]

  // How far the page has been read, as a number between the two shapes. The
  // window rather than the section, because the hero is what is being scrolled
  // away from rather than into.
  const runwayRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: runwayRef,
    offset: ['start start', 'end start'],
  })

  const inset = useTransform(scrollYProgress, [0, 1], [0, 40])
  const lift = useTransform(scrollYProgress, [0, 1], [0, 72])
  const corner = useTransform(scrollYProgress, [0, 1], [0, 28])
  const height = useTransform(scrollYProgress, [0, 1], ['100svh', '68svh'])

  const showNext = useCallback(() => {
    if (items.length > 1 && !isHeld) {
      setIndex((current) => (current + 1) % items.length)
    }
  }, [items.length, isHeld])

  // A backstop rather than the clock the hero runs on. The preview says when
  // it has finished and the hero moves on then, which is what makes it change
  // on a still frame instead of mid-shot; this only covers an item whose clip
  // never arrives, so a hero without previews still rotates.
  useEffect(() => {
    if (items.length < 2 || rotateAfterMilliseconds <= 0 || isHeld) {
      return
    }

    const timer = setTimeout(showNext, rotateAfterMilliseconds)

    return () => {
      clearTimeout(timer)
    }
  }, [items.length, rotateAfterMilliseconds, isHeld, index, showNext])

  const hold = useCallback(() => {
    setIsHeld(true)
  }, [])

  const release = useCallback(() => {
    setIsHeld(false)
  }, [])

  if (featured === undefined) {
    return null
  }

  return (
    // The runway. It is taller than the screen by exactly the scrolling the
    // hero holds on to, and the hero sticks to the top of it — so the page
    // does not begin to move until the picture has finished becoming a card.
    <div
      ref={runwayRef}
      className="relative"
      style={{
        height:
          prefersReducedMotion === true
            ? undefined
            : `calc(100svh + ${DRAWS_IN_BY_PIXELS.toString()}px)`,
      }}
    >
      <motion.section
        aria-label="Featured"
        onPointerEnter={hold}
        onPointerLeave={release}
        onFocusCapture={hold}
        onBlurCapture={release}
        // Nobody who asked for less movement gets any: they get the card, at
        // the size and shape the scrolling would have arrived at.
        style={
          prefersReducedMotion === true
            ? { height: '68svh', marginLeft: 40, marginRight: 40, marginTop: 72, borderRadius: 28 }
            : {
                height,
                marginLeft: inset,
                marginRight: inset,
                marginTop: lift,
                borderRadius: corner,
              }
        }
        // A card rather than a full-bleed opening shot: inset from the edges,
        // cornered like everything else on the page, and short enough that the
        // first row of the library shows underneath it. The page reads as a
        // library with something at the top of it rather than as a poster with
        // a library hidden behind it.
        // It opens as the whole screen and draws itself in as the page moves:
        // arriving is an opening shot, and reading is a library with something
        // at the top of it. The sizes are driven by the scroll rather than by a
        // class, because halfway between the two states is a real state.
        className={cn(
          'sticky top-0 flex flex-col justify-end overflow-hidden',
          'ring-1 ring-white/10 shadow-[0_40px_80px_-40px_rgba(0,0,0,0.9)]',
        )}
      >
        {/* The picture crossfades under the text rather than cutting, so a
          rotation reads as one screen changing its mind rather than as two
          screens swapping. */}
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
              tint={featured.accentColor ?? null}
              onEnded={showNext}
              fills
            />
          </motion.div>
        </AnimatePresence>

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-surface via-surface/60 to-transparent" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-surface/85 via-transparent to-transparent" />

        {/* Keyed rather than held in a presence: waiting for the old text to
          leave before the new arrives leaves a beat with no title at all, and
          the picture crossfading underneath already carries the change. */}
        <motion.div
          key={featured.id}
          variants={staggerVariants}
          initial="hidden"
          animate="shown"
          // On the same line as the markers opposite it, so the foot of the
          // picture reads as one row rather than as two things at different
          // heights.
          className="relative flex flex-col gap-3 px-5 pb-8 pt-24 sm:px-10"
        >
          {/* The episode above the show, small and set in capitals: it is what
            is being offered, and the show underneath is what makes it
            recognisable. A film has nothing here, since its own name is the
            title below. */}
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
            // Sized against the viewport rather than in steps, so the title is
            // as large as the screen allows at every width instead of jumping
            // between three fixed sizes.
            className="max-w-[16ch] text-[clamp(2rem,6.5vw,5rem)] font-semibold leading-[0.95] tracking-[-0.035em] text-text"
          >
            {featured.seriesTitle ?? featured.title}
          </motion.h1>

          {/* Everything that places it, on one line and in one voice: where it
            sits in the series, what it scored, and when it was made. Separated
            by dots rather than by space alone, so four facts read as a list
            rather than as a row of unrelated numbers. */}
          {facts.length === 0 ? null : (
            <motion.p
              variants={revealVariants(prefersReducedMotion)}
              transition={revealTransition(prefersReducedMotion)}
              className="flex flex-wrap items-center gap-2 text-sm font-medium tracking-[0.14em] text-text-muted"
            >
              {facts.map((fact, at) => (
                <span key={fact.key} className="flex items-center gap-2">
                  {at === 0 ? null : <span aria-hidden>·</span>}
                  {fact.said}
                </span>
              ))}
            </motion.p>
          )}

          <motion.div
            variants={revealVariants(prefersReducedMotion)}
            transition={revealTransition(prefersReducedMotion)}
            className="flex flex-wrap items-center gap-3 pt-2"
          >
            {/* One button, because there is only one thing anybody wants from a
              hero. What it says depends on whether they have been here
              before. */}
            <Button
              variant="glossy"
              size="lg"
              isPill
              onClick={() => {
                onPlay(featured, resume ?? 0)
              }}
            >
              <IconPlayerPlayFilled size={18} aria-hidden />
              {resume === null ? 'Play' : `Resume from ${formatDuration(resume)}`}
            </Button>

            {/* Two things worth offering: watch it, or find out what it is. A
              hero that only plays makes somebody guess before committing. */}
            {onInspect === undefined ? null : (
              <Button
                variant="secondary"
                size="lg"
                isPill
                onClick={() => {
                  onInspect(featured)
                }}
              >
                <IconInfoCircle size={18} aria-hidden />
                More info
              </Button>
            )}
          </motion.div>
        </motion.div>

        {items.length < 2 ? null : (
          <ul className="absolute bottom-8 right-5 flex items-center gap-2 sm:right-10">
            {items.map((item, position) => (
              <li key={item.id}>
                {/* The bar is two pixels tall and the button around it is not:
                  a target the height of the line it draws is a target nobody
                  hits. The name appears on the way to it, so choosing the next
                  item is a decision rather than a guess. */}
                <button
                  type="button"
                  aria-label={`Show ${item.title}`}
                  aria-current={position === index ? 'true' : undefined}
                  onClick={() => {
                    setIndex(position)
                  }}
                  className="group relative flex items-center px-0.5 py-2"
                >
                  {/* Lifted out of the flow: an invisible label still takes its
                    full width, which pushed the markers as far apart as the
                    titles are long. */}
                  <span className="pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap text-xs font-medium tracking-tight text-text opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    {item.title}
                  </span>

                  <span
                    className={`block h-1.5 rounded-full transition-all duration-300 ${
                      position === index
                        ? 'w-6 bg-text'
                        : 'w-1.5 bg-text-muted/40 group-hover:bg-text-muted'
                    }`}
                  />
                </button>
              </li>
            ))}
          </ul>
        )}
      </motion.section>
    </div>
  )
}

Hero.displayName = 'Hero'

export default { Hero }
