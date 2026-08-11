import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion,
} from 'motion/react'
import { IconInfoCircle, IconPlayerPlayFilled, IconStar } from '@tabler/icons-react'
import MediaCardModule from '@FluxUI/MediaCard'
import BadgeModule from '@FluxUI/Badge'
import ButtonModule from '@FluxUI/Button'
import revealModule from '@FluxUI/animations/reveal'
import formatDurationModule from '@FluxCore/functions/formatDuration'
import fetchLibraryModule from '@FluxWeb/library/fetchLibrary'
import MediaPreviewModule from '@FluxWeb/components/MediaPreview/MediaPreview'
import type { MediaDetail } from '@FluxContracts/schemas/Library'
import type { RailCardProps } from './RailCard.types'

const { MediaCard } = MediaCardModule
const { Badge } = BadgeModule
const { Button } = ButtonModule
const { liquidSpring } = revealModule
const { formatDuration } = formatDurationModule
const { fetchMediaDetail } = fetchLibraryModule
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
 * How many genres are worth naming on a card.
 */
const GENRE_LIMIT = 3

/**
 * How far the open card leans towards the pointer, in degrees.
 *
 * Small on purpose. Enough that the panel feels like an object being looked
 * at rather than a picture stuck to the glass, and not so much that reading it
 * means fighting perspective.
 */
const TILT = 7

/**
 * How the lean settles.
 *
 * Soft and slow to arrive, so the panel follows the pointer rather than
 * tracking it exactly — a card that mirrors every twitch reads as nervous.
 */
const LEAN = { stiffness: 150, damping: 18, mass: 0.6 } as const

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
 * Moves an opened card back inside the window.
 *
 * The panel is taller than the card it grew from — that is the point of it —
 * and a row near the foot of the screen grows straight past the bottom edge,
 * where the description and the buttons are simply not there. Measured after
 * it is drawn, because how tall it is depends on how much is known about the
 * item.
 */
const fitInside = (top: number, height: number): number => {
  const lowest = window.innerHeight - height - MARGIN

  return Math.max(Math.min(top, lowest), MARGIN)
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
  resumeSeconds,
  hoverDelayMilliseconds = HOVER_DELAY_MILLISECONDS,
}: RailCardProps) => {
  // Read only once a card has actually been opened. A row of twenty cards
  // asking the server about themselves on the way past would be twenty
  // requests for a page nobody has stopped on.
  const [detail, setDetail] = useState<MediaDetail | null>(null)
  const holderRef = useRef<HTMLDivElement>(null)
  // Where the pointer is over the card, from -0.5 at one edge to 0.5 at the
  // other. Motion values rather than state: this changes on every mouse move,
  // and re-rendering a panel with a video in it that often would be absurd.
  const towardsX = useMotionValue(0)
  const towardsY = useMotionValue(0)
  const leanX = useSpring(towardsX, LEAN)
  const leanY = useSpring(towardsY, LEAN)
  const rotateY = useTransform(leanX, (along) => along * TILT)
  const rotateX = useTransform(leanY, (down) => down * -TILT)
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

  useEffect(() => {
    if (anchor === null || detail !== null) {
      return
    }

    let abandoned = false

    void fetchMediaDetail(media.id).then((found) => {
      if (!abandoned) {
        setDetail(found)
      }
    })

    return () => {
      abandoned = true
    }
  }, [anchor, detail, media.id])

  // Measured once it exists and moved up if it would hang off the bottom. A
  // card at the foot of the screen is exactly the one somebody has scrolled to
  // look at.
  const panelRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const panel = panelRef.current

    if (anchor === null || panel === null) {
      return
    }

    const fit = () => {
      const fitted = fitInside(anchor.top, panel.offsetHeight)

      if (Math.abs(fitted - anchor.top) > 1) {
        setAnchor({ ...anchor, top: fitted })
      }
    }

    fit()

    // And again whenever it changes size. What a card knows about itself —
    // its genres, its synopsis — arrives after it has opened, so the panel
    // measured on the way in is shorter than the one being looked at a moment
    // later, and the difference is exactly the part that falls off the bottom.
    const watcher = new ResizeObserver(fit)

    watcher.observe(panel)

    return () => {
      watcher.disconnect()
    }
  }, [anchor])

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
      onPointerLeave={() => {
        cancel()
        towardsX.set(0)
        towardsY.set(0)
      }}
      onPointerMove={(event) => {
        const holder = holderRef.current

        if (holder === null || prefersReducedMotion === true) {
          return
        }

        const box = holder.getBoundingClientRect()

        towardsX.set((event.clientX - box.left) / box.width - 0.5)
        towardsY.set((event.clientY - box.top) / box.height - 0.5)
      }}
    >
      <MediaCard
        title={media.title}
        subtitle={subtitle}
        shape="wide"
        {...(watchedFraction === undefined ? {} : { watchedFraction })}
        {...(artworkUrl === undefined ? {} : { imageUrl: artworkUrl })}
        onSelect={() => {
          onInspect(media)
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
                // Perspective on the panel itself, so leaning towards the
                // pointer reads as depth rather than as a squash.
                transformPerspective: 900,
                rotateX,
                rotateY,
              }}
              // A column that gives up the description before it gives up the
              // buttons. A card opened near the foot of a tall row is exactly
              // the one that runs out of screen, and the thing to lose there is
              // the third line of a synopsis, not the way to play it.
              className="fixed z-40 flex max-h-[calc(100svh_-_1.5rem)] flex-col overflow-hidden rounded-2xl bg-surface-raised shadow-2xl ring-1 ring-white/10"
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

              {/* The whole panel opens the page. Somebody who has stopped
                    on a card and read it wants to know more about it, and
                    making them find a small button to say so is a puzzle
                    rather than an interface. */}
              <button
                type="button"
                aria-label={`About ${media.title}`}
                onClick={() => {
                  onInspect(media)
                }}
                className="flex min-h-0 w-full flex-1 flex-col gap-3 p-4 text-left"
              >
                <span className="flex flex-col gap-1">
                  {detail?.metadata.seriesTitle === undefined ||
                  detail.metadata.seriesTitle === null ? null : (
                    <span className="text-xs uppercase tracking-[0.14em] text-text-muted">
                      {detail.metadata.seriesTitle}
                    </span>
                  )}

                  <span className="text-sm font-medium leading-tight text-text">{media.title}</span>
                </span>

                <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
                  {media.year === null ? null : <span>{media.year}</span>}
                  <span>{formatDuration(media.durationSeconds)}</span>

                  {detail?.metadata.rating === undefined ||
                  detail.metadata.rating === null ? null : (
                    <span className="flex items-center gap-1">
                      <IconStar size={12} aria-hidden />
                      {detail.metadata.rating.toFixed(1)}
                    </span>
                  )}

                  {typeof media.seasonNumber !== 'number' ||
                  typeof media.episodeNumber !== 'number' ? null : (
                    <span>
                      S{media.seasonNumber} · E{media.episodeNumber}
                    </span>
                  )}
                </span>

                {(detail?.metadata.genres ?? []).length === 0 ? null : (
                  <span className="flex flex-wrap gap-1.5">
                    {(detail?.metadata.genres ?? []).slice(0, GENRE_LIMIT).map((genre) => (
                      <Badge key={genre} size="sm">
                        {genre}
                      </Badge>
                    ))}
                  </span>
                )}

                {detail?.metadata.overview === undefined ||
                detail.metadata.overview === null ||
                detail.metadata.overview === '' ? null : (
                  <span className="line-clamp-3 min-h-0 shrink overflow-hidden text-xs leading-relaxed text-text-muted">
                    {detail.metadata.overview}
                  </span>
                )}

                {/* At the foot, after the reading: somebody decides what to do
                    with a thing once they know what it is. Two things worth
                    offering, said plainly rather than left to be guessed at.
                    The same controls as everywhere else — a card is not the
                    place to invent a second shape of play button. */}
                <span className="flex shrink-0 flex-wrap items-center gap-2 pt-1">
                  <Button
                    variant="glossy"
                    size="sm"
                    isPill
                    onClick={(event) => {
                      // Inside the panel, so its press must not also read as a
                      // press on the panel behind it.
                      event.stopPropagation()
                      onPlay(media, resumeSeconds ?? 0)
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
                      event.stopPropagation()
                      onInspect(media)
                    }}
                  >
                    <IconInfoCircle size={16} aria-hidden />
                    More info
                  </Button>
                </span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  )
}

RailCard.displayName = 'RailCard'

export default { RailCard }
