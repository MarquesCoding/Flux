import { IconPlayerPlay } from '@tabler/icons-react'
import cnModule from '@FluxUI/cn'
import type { MediaCardProps } from './MediaCard.types'

const { cn } = cnModule

/**
 * One item in a library grid.
 *
 * A button rather than a card with a nested button: the whole tile is the
 * target, which is what a pointer expects and what keyboard and screen reader
 * users need. A clickable `div` would be reachable by neither.
 *
 * The poster falls back to the title's first letter. Artwork arrives with
 * metadata providers, and a grid of empty rectangles until then would be
 * unusable.
 */
const MediaCard = ({
  title,
  subtitle,
  badges = [],
  posterUrl,
  onSelect,
  className,
}: MediaCardProps) => {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'group flex flex-col gap-2 rounded-lg text-left',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        className,
      )}
    >
      <span className="relative block aspect-[2/3] overflow-hidden rounded-lg border border-border bg-surface-raised">
        {posterUrl === undefined ? (
          <span
            aria-hidden
            className="flex h-full w-full items-center justify-center text-4xl font-semibold text-text-muted"
          >
            {title.slice(0, 1).toUpperCase()}
          </span>
        ) : (
          <img src={posterUrl} alt="" className="h-full w-full object-cover" />
        )}

        <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
          <IconPlayerPlay size={32} className="text-white" aria-hidden />
        </span>
      </span>

      <span className="flex flex-col gap-0.5">
        <span className="line-clamp-2 text-sm font-medium text-text">{title}</span>
        <span className="text-xs text-text-muted">{subtitle}</span>

        {badges.length === 0 ? null : (
          <span className="mt-1 flex flex-wrap gap-1">
            {badges.map((badge) => (
              <span
                key={badge}
                className="rounded-sm bg-surface-raised px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-text-muted"
              >
                {badge}
              </span>
            ))}
          </span>
        )}
      </span>
    </button>
  )
}

MediaCard.displayName = 'MediaCard'

export default { MediaCard }
