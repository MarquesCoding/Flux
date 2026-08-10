import formatDurationModule from '@FluxCore/functions/formatDuration'
import type { MediaSummary } from '@FluxContracts/schemas/Library'

const { formatDuration } = formatDurationModule

/**
 * The line beneath a title in the grid.
 *
 * Year first because it is what people scan for, then runtime. A missing year
 * is omitted rather than shown as a placeholder.
 */
const describeMedia = (media: MediaSummary): string =>
  [media.year === null ? null : String(media.year), formatDuration(media.durationSeconds)]
    .filter((part) => part !== null)
    .join(' · ')

/**
 * The badges shown on a tile.
 *
 * Resolution is expressed the way people talk about it rather than in pixels,
 * and SDR is left unsaid because it is the default rather than a feature.
 */
const describeBadges = (media: MediaSummary): string[] => {
  const badges: string[] = []

  if (media.width >= 3000) {
    badges.push('4K')
  } else if (media.height >= 1000) {
    badges.push('1080p')
  } else if (media.height >= 700) {
    badges.push('720p')
  }

  if (media.videoRange !== 'SDR') {
    badges.push(media.videoRange)
  }

  return badges
}

export default { describeMedia, describeBadges }
