const SYNC = 'Run pnpm ffmpeg:sync to fetch the build Flux ships.';

type PlanFfmpegNoticeOptions = {
  ffmpeg: string | undefined;
  ffprobe: string | undefined;
  exists: (path: string) => boolean;
};

/**
 * Says when the media service is about to start on an FFmpeg that is not the one Flux ships.
 *
 * Silence is the problem this exists against. Left unset the service falls back to whatever is on
 * PATH and keeps working, minus the filters that hold frames on the device — so the cost is real,
 * invisible, and looks exactly like hardware that cannot do better.
 *
 * Both variables are checked, because the service reads them independently: setting only one
 * transcodes with Flux's build while still probing with another.
 *
 * @param options - What the environment says, and how to tell whether a path is really there.
 * @returns The warning to print, or undefined when both point at something that exists.
 */
const planFfmpegNotice = ({
  ffmpeg,
  ffprobe,
  exists,
}: PlanFfmpegNoticeOptions): string | undefined => {
  const named = [
    { variable: 'FLUX_FFMPEG', path: ffmpeg },
    { variable: 'FLUX_FFPROBE', path: ffprobe },
  ];

  const set = named.filter((entry) => entry.path !== undefined && entry.path.length > 0);

  if (set.length === 0) {
    return [
      'The media service will use whatever ffmpeg is on PATH, which is not the build Flux ships.',
      'Subtitles and HDR will leave the hardware, and nothing else will say so.',
      SYNC,
    ].join('\n');
  }

  const missing = set.filter((entry) => entry.path !== undefined && !exists(entry.path));

  if (missing.length > 0) {
    return [
      ...missing.map(
        (entry) => `${entry.variable} points at ${entry.path ?? ''}, which is not there.`,
      ),
      'The media service will fall back to PATH.',
      SYNC,
    ].join('\n');
  }

  if (set.length === 1) {
    const absent = named.find((entry) => entry.path === undefined || entry.path.length === 0);

    return [
      `${absent?.variable ?? ''} is not set, and it is read separately from the other.`,
      'The media service will transcode with one build and probe with another.',
      SYNC,
    ].join('\n');
  }

  return undefined;
};

export type { PlanFfmpegNoticeOptions };

export { planFfmpegNotice };
