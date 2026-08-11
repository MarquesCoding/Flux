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

export default { describeMedia }
