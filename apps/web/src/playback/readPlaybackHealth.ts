import type { PlaybackHealth } from '@FluxWeb/components/VideoPlayer/components/StreamStats/StreamStats.types'

/**
 * The last moment of the stream that exists.
 *
 * A transcode is delivered as a playlist that grows, so this is how much has
 * been encoded rather than how long the film is. Read defensively because an
 * element that has loaded nothing reports no ranges at all.
 */
const encodedSeconds = (element: HTMLVideoElement): number => {
  try {
    const ranges = element.seekable

    return ranges.length > 0 ? ranges.end(ranges.length - 1) : 0
  } catch {
    return 0
  }
}

/**
 * How much is buffered past where the viewer is.
 *
 * The range containing the current position is the only one that matters: a
 * later range is separated by a gap playback will stall in.
 */
const bufferedAhead = (element: HTMLVideoElement): number => {
  try {
    const ranges = element.buffered

    for (let index = 0; index < ranges.length; index += 1) {
      if (ranges.start(index) <= element.currentTime && ranges.end(index) >= element.currentTime) {
        return ranges.end(index) - element.currentTime
      }
    }

    return 0
  } catch {
    return 0
  }
}

/**
 * A source of frame counts.
 *
 * Declared optional because not every browser implements it, which the DOM
 * types do not admit.
 */
type FrameCountSource = {
  getVideoPlaybackQuality?: () => { droppedVideoFrames: number; totalVideoFrames: number }
}

/**
 * Frame counts, where the browser keeps them.
 *
 * Not every browser implements this, and a decoder that is dropping frames is
 * precisely when someone opens this panel, so absence is reported rather than
 * shown as zero.
 */
const frameCounts = (
  element: FrameCountSource,
): { dropped: number | null; decoded: number | null } => {
  const quality = element.getVideoPlaybackQuality?.()

  if (quality === undefined) {
    return { dropped: null, decoded: null }
  }

  return { dropped: quality.droppedVideoFrames, decoded: quality.totalVideoFrames }
}

/**
 * Samples what the browser is actually doing with the stream.
 *
 * Everything here comes from the media element rather than from the server,
 * because the two disagreeing is the situation the stats panel exists to make
 * visible.
 */
const readPlaybackHealth = (
  element: HTMLVideoElement,
  sessionStartSeconds: number,
): PlaybackHealth => {
  const frames = frameCounts(element)

  return {
    positionSeconds: sessionStartSeconds + element.currentTime,
    bufferedAheadSeconds: bufferedAhead(element),
    encodedSeconds: encodedSeconds(element),
    droppedFrames: frames.dropped,
    decodedFrames: frames.decoded,
    presentedWidth: element.videoWidth,
    presentedHeight: element.videoHeight,
  }
}

export type { FrameCountSource }

export default { readPlaybackHealth, encodedSeconds, bufferedAhead }
