import RailCardModule from '@FluxWeb/components/RailCard/RailCard'
import type { MediaGridProps } from './MediaGrid.types'

const { RailCard } = RailCardModule

/**
 * A page of items, laid out as a grid.
 *
 * What every page that is not the home page shows: results, a kind of thing,
 * everything kept. Rails are for a page that is arguing for something — this
 * is for a page answering a question, where the answer is a set and the shape
 * of a set is a grid.
 *
 * The same card as a rail uses, so an item looks like itself wherever it is
 * found and behaves the same when stopped on.
 */
const MediaGrid = ({
  items,
  onPlay,
  onInspect,
  watchedFractionFor,
  resumeFor,
  isKept,
  onToggleKept,
}: MediaGridProps) => (
  <ul className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
    {items.map((media) => (
      <li key={media.id}>
        <RailCard
          media={media}
          {...(watchedFractionFor?.(media.id) === undefined
            ? {}
            : { watchedFraction: watchedFractionFor(media.id) ?? 0 })}
          {...(resumeFor === undefined || resumeFor(media.id) === null
            ? {}
            : { resumeSeconds: Math.floor(resumeFor(media.id) ?? 0) })}
          onPlay={onPlay}
          onInspect={onInspect}
          {...(isKept === undefined ? {} : { isKept: isKept(media.id) })}
          {...(onToggleKept === undefined ? {} : { onToggleKept })}
        />
      </li>
    ))}
  </ul>
)

MediaGrid.displayName = 'MediaGrid'

export default { MediaGrid }
