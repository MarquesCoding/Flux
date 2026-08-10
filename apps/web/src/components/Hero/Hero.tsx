import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { IconPlayerPlayFilled, IconStar } from '@tabler/icons-react'
import ButtonModule from '@FluxUI/Button'
import revealModule from '@FluxUI/animations/reveal'
import formatDurationModule from '@FluxCore/functions/formatDuration'
import MediaPreviewModule from '@FluxWeb/components/MediaPreview/MediaPreview'
import type { HeroProps } from './Hero.types'

const { Button } = ButtonModule
const { revealVariants, revealTransition, staggerVariants } = revealModule
const { formatDuration } = formatDurationModule
const { MediaPreview } = MediaPreviewModule

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
    <section
      aria-label="Featured"
      onPointerEnter={hold}
      onPointerLeave={release}
      onFocusCapture={hold}
      onBlurCapture={release}
      className="relative flex min-h-[88svh] flex-col justify-end overflow-hidden"
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
        className="relative flex flex-col gap-3 px-5 pb-24 pt-24 sm:px-10 sm:pb-28"
      >
        {featured.year === null && rating === null ? null : (
          <motion.p
            variants={revealVariants(prefersReducedMotion)}
            transition={revealTransition(prefersReducedMotion)}
            className="flex items-center gap-4 text-sm font-medium tracking-[0.2em] text-text-muted"
          >
            {featured.year === null ? null : <span>{featured.year}</span>}

            {rating === null ? null : (
              <span className="flex items-center gap-1.5">
                <IconStar size={14} aria-hidden />
                {rating.toFixed(1)}
              </span>
            )}
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
          {featured.title}
        </motion.h1>

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
        </motion.div>
      </motion.div>

      {items.length < 2 ? null : (
        <ul className="absolute bottom-8 right-5 flex flex-col items-end sm:right-10">
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
                className="group flex items-center justify-end gap-3 py-2 pl-6"
              >
                <span
                  className={`whitespace-nowrap text-xs font-medium tracking-tight transition-opacity duration-300 ${
                    position === index
                      ? 'text-text opacity-0 group-hover:opacity-100'
                      : 'text-text-muted opacity-0 group-hover:opacity-100'
                  }`}
                >
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
    </section>
  )
}

Hero.displayName = 'Hero'

export default { Hero }
