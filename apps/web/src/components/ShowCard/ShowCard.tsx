import MediaCardModule from '@FluxUI/MediaCard'
import type { ShowCardProps } from './ShowCard.types'

const { MediaCard } = MediaCardModule

/**
 * Where a show's artwork comes from: the episode that opens it.
 */
const artworkUrl = (mediaId: string): string => `/api/media/${mediaId}/image/backdrop`

/**
 * Says how much of a programme there is, the way somebody would.
 */
const describeShow = (seasonCount: number, episodeCount: number): string => {
  const episodes = episodeCount === 1 ? '1 episode' : `${episodeCount.toString()} episodes`

  return seasonCount <= 1 ? episodes : `${seasonCount.toString()} seasons · ${episodes}`
}

/**
 * A programme on a shelf.
 *
 * The same card as an episode uses, so a row of shows sits beside a row of
 * films without either looking foreign. What it says is different, because
 * what somebody wants to know about a programme is how much of it there is
 * rather than how long one piece of it runs.
 */
const ShowCard = ({ show, onSelect }: ShowCardProps) => (
  <MediaCard
    title={show.title}
    subtitle={describeShow(show.seasonCount, show.episodeCount)}
    shape="wide"
    imageUrl={artworkUrl(show.coverMediaId)}
    onSelect={() => {
      onSelect(show)
    }}
    className="w-full"
  />
)

ShowCard.displayName = 'ShowCard'

export default { ShowCard, describeShow }
