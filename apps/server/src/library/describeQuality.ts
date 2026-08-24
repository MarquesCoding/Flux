const RESOLUTIONS = [
  { atLeast: 2160, named: '4K' },
  { atLeast: 1440, named: '1440p' },
  { atLeast: 1080, named: '1080p' },
  { atLeast: 720, named: '720p' },
  { atLeast: 480, named: '480p' },
] as const;

const PLAIN_RANGES = new Set(['SDR', '']);

const WIDE_NUMERATOR = 9;

const WIDE_DENOMINATOR = 16;

const NEARLY = 0.95;

/**
 * Works out the height a file would have if nothing had been cropped off it.
 *
 * Neither dimension alone names a release. A 1080p Bluray of a 2.40:1 film is 1920 by 800, so its
 * height says 720p; a 4:3 broadcast at 1440 by 1080 is a full 1080 tall, so its width says 720p.
 * Taking whichever of the two is larger once the width is read back as a sixteen-by-nine frame
 * answers both: the black bars are above and below in one and at the sides in the other, and the
 * dimension that was not cropped is the one that survives.
 *
 * @param width - How many columns the picture has.
 * @param height - How many rows it has.
 * @returns The height to judge it by.
 */
const framedHeight = (width: number, height: number): number =>
  Math.max(height, Math.round((width * WIDE_NUMERATOR) / WIDE_DENOMINATOR));

/**
 * Says what a file looks like in the words a person uses for it — "4K HDR10" rather than 3840 by 2160
 * with a range field beside it.
 *
 * @param width - How many columns the picture has.
 * @param height - How many rows it has.
 * @param videoRange - The dynamic range the file declares.
 * @returns What to call it, or null where nothing is known.
 */
const describeQuality = (
  width: number | null,
  height: number | null,
  videoRange: string | null,
): string | null => {
  const framed = width === null || height === null ? null : framedHeight(width, height);

  const resolution =
    framed === null
      ? null
      : (RESOLUTIONS.find((one) => framed >= one.atLeast * NEARLY)?.named ?? null);

  const range = videoRange === null || PLAIN_RANGES.has(videoRange) ? null : videoRange;

  if (resolution === null) {
    return range;
  }

  return range === null ? resolution : `${resolution} ${range}`;
};

export { describeQuality };
