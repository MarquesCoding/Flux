import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { IconPlayerPlayFilled } from '@tabler/icons-react'
import { cn } from '@FluxUI/cn'
import { hasFinePointer } from '@FluxUI/hasFinePointer'
import { Badge } from '@FluxUI/Badge'
import { revealTransition } from '@FluxUI/animations/reveal'
import type { MediaCardProps, MediaCardShape } from './MediaCard.types'

const SHAPE_CLASSES: Record<MediaCardShape, string> = {
  poster: 'aspect-[2/3]',
  wide: 'aspect-video',
}

/**
 * One item in a library.
 *
 * A button rather than a card with a nested button: the whole tile is the
 * target, which is what a pointer expects and what keyboard and screen reader
 * users need. A clickable `div` would be reachable by neither.
 *
 * A lead card wears its title over the artwork, where a standard one carries
 * it underneath. That difference is what gives a row a shape — the eye lands
 * on the large one and reads outwards from it.
 *
 * With no artwork, the initial is set enormous and cropped rather than
 * centred politely. A library before its first metadata provider should look
 * deliberate, not unfinished.
 */
const MediaCard = ({
  title,
  eyebrow,
  subtitle,
  badges = [],
  imageUrl,
  shape = 'poster',
  emphasis = 'standard',
  watchedFraction,
  onSelect,
  isStill = false,
  className,
}: MediaCardProps) => {
  const prefersReducedMotion = useReducedMotion()
  const isLead = emphasis === 'lead'
  // Whether lifting towards a pointer means anything here. A finger reports a
  // hover as it lands and goes on reporting it once it has gone, so a card on
  // a phone would rise on being tapped and stay risen.
  const [canHover, setCanHover] = useState(false)

  useEffect(() => {
    setCanHover(hasFinePointer())
  }, [])

  return (
    <motion.button
      type="button"
      onClick={onSelect}
      // Spread rather than passed as undefined: with exact optional property
      // types, an absent prop and a prop set to nothing are different things.
      {...(prefersReducedMotion === true || isStill || !canHover
        ? {}
        : { whileHover: { y: -6 }, whileTap: { scale: 0.985 } })}
      transition={revealTransition(prefersReducedMotion)}
      className={cn('group flex w-full flex-col gap-3 rounded-2xl text-left', className)}
    >
      <span
        className={cn(
          'relative block overflow-hidden rounded-2xl bg-surface-raised',
          'shadow-[0_18px_40px_-24px_rgba(0,0,0,0.9)] ring-1 ring-white/10',
          SHAPE_CLASSES[shape],
        )}
      >
        {imageUrl === undefined ? (
          <span
            aria-hidden
            className="absolute -bottom-[0.15em] -left-[0.06em] text-[9rem] font-semibold leading-none tracking-tighter text-white/[0.07]"
          >
            {title.slice(0, 1).toUpperCase()}
          </span>
        ) : (
          <img
            src={imageUrl}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        )}

        <span className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent opacity-70 transition-opacity group-hover:opacity-90" />

        <span className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <span className="flux-glass flex size-14 items-center justify-center rounded-full">
            <IconPlayerPlayFilled size={22} className="text-white" aria-hidden />
          </span>
        </span>

        {badges.length === 0 ? null : (
          <span className="absolute left-3 top-3 flex flex-wrap gap-1.5">
            {badges.map((badge) => (
              <Badge key={badge} tone="solid">
                {badge}
              </Badge>
            ))}
          </span>
        )}

        {watchedFraction === undefined ? null : (
          <span className="absolute inset-x-0 bottom-0 h-1 bg-black/50">
            <span
              className="block h-full bg-accent"
              style={{ width: `${(Math.min(Math.max(watchedFraction, 0), 1) * 100).toString()}%` }}
            />
          </span>
        )}

        {isLead ? (
          <span className="absolute inset-x-4 bottom-4 flex flex-col gap-1">
            {eyebrow === undefined ? null : (
              <span className="text-[0.65rem] uppercase tracking-[0.18em] text-white/60">
                {eyebrow}
              </span>
            )}

            <span className="text-2xl font-semibold leading-tight tracking-tight text-white sm:text-3xl">
              {title}
            </span>
            <span className="font-body text-xs text-white/70">{subtitle}</span>
          </span>
        ) : null}
      </span>

      {isLead ? null : (
        <span className="flex flex-col gap-0.5 px-0.5">
          {/* What is being offered, over what makes it recognisable. Small and
              in capitals so it reads as a label rather than as a second
              title. */}
          {eyebrow === undefined ? null : (
            <span className="line-clamp-1 text-[0.65rem] uppercase tracking-[0.16em] text-text-muted">
              {eyebrow}
            </span>
          )}

          <span className="line-clamp-1 text-sm font-medium text-text">{title}</span>
          <span className="line-clamp-1 font-body text-xs text-text-muted">{subtitle}</span>
        </span>
      )}
    </motion.button>
  )
}

MediaCard.displayName = 'MediaCard'

export { MediaCard }
