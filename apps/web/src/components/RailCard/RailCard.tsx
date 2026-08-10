import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { IconInfoCircle, IconPlayerPlayFilled } from '@tabler/icons-react'
import MediaCardModule from '@FluxUI/MediaCard'
import IconButtonModule from '@FluxUI/IconButton'
import revealModule from '@FluxUI/animations/reveal'
import formatDurationModule from '@FluxCore/functions/formatDuration'
import MediaPreviewModule from '@FluxWeb/components/MediaPreview/MediaPreview'
import type { RailCardProps } from './RailCard.types'

const { MediaCard } = MediaCardModule
const { IconButton } = IconButtonModule
const { liquidSpring } = revealModule
const { formatDuration } = formatDurationModule
const { MediaPreview } = MediaPreviewModule

/**
 * How long a pointer rests before a card opens.
 */
const HOVER_DELAY_MILLISECONDS = 600

/**
 * How much larger the open card is than the one it grew from.
 */
const GROWTH = 1.35

/**
 * How far from the edge of the window the open card must stay.
 */
const MARGIN = 12

/**
 * Where a card is on screen.
 */
type Anchor = { left: number; top: number; width: number }

/**
 * Whether this is a device where hovering means anything.
 *
 * A touch screen reports a hover the moment a finger lands, which would open a
 * card every time somebody scrolled a row.
 */
const hasPointer = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches

/**
 * Places the open card over the one it grew from.
 *
 * Kept inside the window on both sides, because the first and last cards of a
 * row are exactly the ones whose expansion would otherwise fall off screen.
 */
const placeOver = (rect: DOMRect): Anchor => {
  const width = rect.width * GROWTH
  const centred = rect.left + rect.width / 2 - width / 2
  const furthest = window.innerWidth - width - MARGIN

  return {
    width,
    left: Math.min(Math.max(centred, MARGIN), Math.max(furthest, MARGIN)),
    top: rect.top - (rect.height * (GROWTH - 1)) / 2,
  }
}

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
  subtitle,
  watchedFraction,
  onPlay,
  onInspect,
  hoverDelayMilliseconds = HOVER_DELAY_MILLISECONDS,
}: RailCardProps) => {
  const holderRef = useRef<HTMLDivElement>(null)
  const [anchor, setAnchor] = useState<Anchor | null>(null)
  const prefersReducedMotion = useReducedMotion()

  const close = useCallback(() => {
    setAnchor(null)
  }, [])

  useEffect(() => {
    if (anchor === null) {
      return
    }

    // Scrolling the row, or the page, moves the card out from under its own
    // expansion. Following it would mean measuring on every frame; closing is
    // both cheaper and what someone scrolling actually wants.
    window.addEventListener('scroll', close, { capture: true, passive: true })

    return () => {
      window.removeEventListener('scroll', close, { capture: true })
    }
  }, [anchor, close])

  const open = useCallback(() => {
    const holder = holderRef.current

    if (holder === null || prefersReducedMotion === true || !hasPointer()) {
      return
    }

    setAnchor(placeOver(holder.getBoundingClientRect()))
  }, [prefersReducedMotion])

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cancel = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  useEffect(() => cancel, [cancel])

  const artworkUrl = media.hasBackdrop
    ? `/api/media/${media.id}/image/backdrop`
    : media.hasPoster
      ? `/api/media/${media.id}/image/poster`
      : undefined

  return (
    <div
      ref={holderRef}
      onPointerEnter={(event) => {
        if (event.pointerType !== 'mouse') {
          return
        }

        cancel()
        timerRef.current = setTimeout(open, hoverDelayMilliseconds)
      }}
      onPointerLeave={cancel}
    >
      <MediaCard
        title={media.title}
        subtitle={subtitle}
        shape="wide"
        {...(watchedFraction === undefined ? {} : { watchedFraction })}
        {...(artworkUrl === undefined ? {} : { imageUrl: artworkUrl })}
        onSelect={() => {
          onPlay(media)
        }}
        className="w-full"
      />

      {anchor === null
        ? null
        : createPortal(
            <AnimatePresence onExitComplete={close}>
              <motion.div
                key={media.id}
                initial={{ opacity: 0, scale: 1 / GROWTH }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1 / GROWTH }}
                transition={liquidSpring}
                onPointerLeave={close}
                style={{ left: anchor.left, top: anchor.top, width: anchor.width }}
                className="fixed z-40 overflow-hidden rounded-2xl bg-surface-raised shadow-2xl ring-1 ring-white/10"
              >
                <div className="aspect-video w-full">
                  <MediaPreview
                    mediaId={media.id}
                    backdropUrl={artworkUrl ?? null}
                    durationSeconds={media.durationSeconds}
                    tint={media.accentColor ?? null}
                    settleMilliseconds={0}
                    fills
                  />
                </div>

                <div className="flex flex-col gap-3 p-4">
                  <div className="flex items-center gap-2">
                    <IconButton
                      label={`Play ${media.title}`}
                      onClick={() => {
                        onPlay(media)
                      }}
                      className="bg-text text-surface"
                    >
                      <IconPlayerPlayFilled size={18} aria-hidden />
                    </IconButton>

                    <IconButton
                      label={`About ${media.title}`}
                      onClick={() => {
                        onInspect(media)
                      }}
                    >
                      <IconInfoCircle size={18} aria-hidden />
                    </IconButton>
                  </div>

                  <p className="text-sm font-medium leading-tight text-text">{media.title}</p>

                  <p className="flex flex-wrap items-center gap-x-3 text-xs text-text-muted">
                    {media.year === null ? null : <span>{media.year}</span>}
                    <span>{formatDuration(media.durationSeconds)}</span>
                  </p>
                </div>
              </motion.div>
            </AnimatePresence>,
            document.body,
          )}
    </div>
  )
}

RailCard.displayName = 'RailCard'

export default { RailCard }
