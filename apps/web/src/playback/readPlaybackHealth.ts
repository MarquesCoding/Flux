import type { PlaybackHealth } from '@FluxWeb/components/VideoPlayer/components/StreamStats/StreamStats.types';

/**
 * Reads the last moment of the stream the element will let anybody seek to, which for a live
 * transcode is how far the encoder has got rather than the end of the film.
 *
 * @param element - The video element.
 * @returns The furthest seekable position, in seconds.
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
 * Measures how much is buffered ahead of where the viewer is, which is the figure that says whether
 * playback is about to stall.
 *
 * @param element - The video element.
 * @returns The seconds buffered ahead.
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
 * Reads the decoded and dropped frame counts where the browser keeps them, which not every browser
 * does.
 *
 * @param element - The video element.
 * @returns The counts, or nothing where this browser does not report them.
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
 * Samples what the browser is actually doing with the stream — buffer, dropped frames, how far the
 * encoder has got — for the stats panel and for the presence heartbeat an operator watches.
 *
 * @param element - The video element.
 * @returns What the browser reports right now.
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

export { readPlaybackHealth, encodedSeconds, bufferedAhead };
