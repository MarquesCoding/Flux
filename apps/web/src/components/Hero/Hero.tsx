import { useCallback, useEffect, useState } from 'react'
import { IconInfoCircle, IconPlayerPlayFilled } from '@tabler/icons-react'
import ButtonModule from '@FluxUI/Button'
import formatDurationModule from '@FluxCore/functions/formatDuration'
import MediaPreviewModule from '@FluxWeb/components/MediaPreview/MediaPreview'
import type { HeroProps } from './Hero.types'

const { Button } = ButtonModule
const { formatDuration } = formatDurationModule
const { MediaPreview } = MediaPreviewModule

/**
 * How long an item holds the screen before the next one takes it.
 *
 * Long enough to read a synopsis, short enough that a library of hundreds does
 * not show the same three films every evening.
 */
const ROTATE_AFTER_MILLISECONDS = 14_000

/**
 * How long the hero waits before starting a preview.
 *
 * Longer than the dialog's wait: arriving at a home page is not the same as
 * choosing something, and a page that starts transcoding the moment it loads
 * is a page that transcodes for nobody.
 */
const PREVIEW_SETTLE_MILLISECONDS = 2500

/**
 * Where an item's artwork is served from.
 */
const artworkUrl = (mediaId: string): string => `/api/media/${mediaId}/image/backdrop`

/**
 * The screen the library opens with.
 *
 * One item at a time, full bleed, with the artwork giving way to a muted
 * preview once someone has stayed long enough to be interested. Rotates
 * between a handful, and stops rotating the moment a viewer reaches for it —
 * a carousel that moves while being read is a carousel nobody reads.
 */
const Hero = ({
  items,
  onPlay,
  onInspect,
  onFeatureChange,
  rotateAfterMilliseconds = ROTATE_AFTER_MILLISECONDS,
}: HeroProps) => {
  const [index, setIndex] = useState(0)
  const [isHeld, setIsHeld] = useState(false)

  const featured = items[index % Math.max(items.length, 1)]

  useEffect(() => {
    if (featured !== undefined) {
      onFeatureChange?.(featured)
    }
  }, [featured, onFeatureChange])

  useEffect(() => {
    if (items.length < 2 || rotateAfterMilliseconds <= 0 || isHeld) {
      return
    }

    const timer = setTimeout(() => {
      setIndex((current) => (current + 1) % items.length)
    }, rotateAfterMilliseconds)

    return () => {
      clearTimeout(timer)
    }
  }, [items.length, rotateAfterMilliseconds, isHeld, index])

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
      className="relative -mt-[4.25rem] flex h-[82vh] min-h-[32rem] flex-col justify-end overflow-hidden"
    >
      <div className="absolute inset-0">
        <MediaPreview
          key={featured.id}
          mediaId={featured.id}
          backdropUrl={featured.hasBackdrop ? artworkUrl(featured.id) : null}
          durationSeconds={featured.durationSeconds}
          settleMilliseconds={PREVIEW_SETTLE_MILLISECONDS}
          fills
        />
      </div>

      {/* Two scrims rather than one: a wash from the bottom so the text has
          something to sit on, and one from the left so it stays legible over a
          bright shot without dimming the whole picture. */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-surface via-surface/70 to-transparent" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-surface/90 via-surface/30 to-transparent" />

      <div className="relative flex max-w-2xl flex-col gap-5 p-6 pb-14 sm:p-10 sm:pb-16">
        <div className="flex flex-col gap-3">
          <h1 className="text-4xl font-semibold tracking-tight text-text drop-shadow-lg sm:text-6xl">
            {featured.title}
          </h1>

          <p className="flex flex-wrap items-center gap-2 text-sm text-text-muted">
            {featured.year === null ? null : <span>{featured.year}</span>}
            <span>{formatDuration(featured.durationSeconds)}</span>
            <span className="rounded-full border border-white/15 px-2 py-0.5 text-xs uppercase tracking-wide">
              {featured.videoRange === 'SDR' ? `${featured.height}p` : featured.videoRange}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="glossy"
            size="xl"
            isPill
            onClick={() => {
              onPlay(featured)
            }}
          >
            <IconPlayerPlayFilled size={20} aria-hidden />
            Watch now
          </Button>

          <Button
            variant="secondary"
            size="xl"
            isPill
            onClick={() => {
              onInspect(featured)
            }}
          >
            <IconInfoCircle size={20} aria-hidden />
            More info
          </Button>
        </div>
      </div>

      {items.length < 2 ? null : (
        <ul className="absolute bottom-6 right-6 flex items-center gap-2">
          {items.map((item, position) => (
            <li key={item.id}>
              <button
                type="button"
                aria-label={`Show ${item.title}`}
                aria-current={position === index ? 'true' : undefined}
                onClick={() => {
                  setIndex(position)
                }}
                className={`h-1.5 rounded-full transition-all ${
                  position === index ? 'w-8 bg-white' : 'w-4 bg-white/40 hover:bg-white/70'
                }`}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

Hero.displayName = 'Hero'

export default { Hero }
