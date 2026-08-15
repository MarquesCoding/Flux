import type { PlaybackHealth } from '@FluxWeb/components/VideoPlayer/components/StreamStats/StreamStats.types';

/**
 * The last moment of the stream the element will let anyone seek to.
 */
const encodedSeconds = (element: HTMLVideoElement): number => {
  try {
    const ranges = element.seekable;

    return ranges.length > 0 ? ranges.end(ranges.length - 1) : 0;
  } catch {
    return 0;
  }
};

/**
 * How much is buffered past where the viewer is.
 */
const bufferedAhead = (element: HTMLVideoElement): number => {
  try {
    const ranges = element.buffered;

    for (let index = 0; index < ranges.length; index += 1) {
      if (ranges.start(index) <= element.currentTime && ranges.end(index) >= element.currentTime) {
        return ranges.end(index) - element.currentTime;
      }
    }

    return 0;
  } catch {
    return 0;
  }
};

type FrameCountSource = {
  getVideoPlaybackQuality?: () => { droppedVideoFrames: number; totalVideoFrames: number };
};

/**
 * Frame counts, where the browser keeps them.
 */
const frameCounts = (
  element: FrameCountSource,
): { dropped: number | null; decoded: number | null } => {
  const quality = element.getVideoPlaybackQuality?.();

  if (quality === undefined) {
    return { dropped: null, decoded: null };
  }

  return { dropped: quality.droppedVideoFrames, decoded: quality.totalVideoFrames };
};

/**
 * Samples what the browser is actually doing with the stream.
 */
const readPlaybackHealth = (element: HTMLVideoElement): PlaybackHealth => {
  const frames = frameCounts(element);

  return {
    positionSeconds: element.currentTime,
    bufferedAheadSeconds: bufferedAhead(element),
    encodedSeconds: encodedSeconds(element),
    droppedFrames: frames.dropped,
    decodedFrames: frames.decoded,
    presentedWidth: element.videoWidth,
    presentedHeight: element.videoHeight,
  };
};

export type { FrameCountSource };

export { readPlaybackHealth, encodedSeconds, bufferedAhead };
