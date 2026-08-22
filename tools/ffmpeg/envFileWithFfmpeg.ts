const ALREADY_SET = /^\s*(?:VALENCE_FFMPEG|VALENCE_FFPROBE)\s*=/mu;

type EnvFileWithFfmpegOptions = {
  existing: string;
  ffmpeg: string;
  ffprobe: string;
};

/**
 * Adds the two paths to an environment file, unless it already says something about them.
 *
 * Never edits a value that is already there. A developer who has pointed these somewhere on purpose
 * — at a build they are testing, or a service on another machine — should not have that quietly
 * replaced by a tool they ran to fetch a download.
 *
 * @param options - The current file, and the paths to record in it.
 * @returns The new contents, or undefined when the file already sets either variable.
 */
const envFileWithFfmpeg = ({
  existing,
  ffmpeg,
  ffprobe,
}: EnvFileWithFfmpegOptions): string | undefined => {
  if (ALREADY_SET.test(existing)) {
    return undefined;
  }

  const separator = existing.length === 0 || existing.endsWith('\n') ? '' : '\n';

  const added = [
    '',
    "# Valence's own FFmpeg, fetched by pnpm ffmpeg:sync.",
    '#',
    '# Left unset, the media service falls back to whatever ffmpeg is on PATH, which on a Mac is',
    "# Homebrew's — and that build has no overlay_videotoolbox and no tonemap_videotoolbox, so",
    '# subtitles and HDR quietly leave the hardware.',
    `VALENCE_FFMPEG=${ffmpeg}`,
    `VALENCE_FFPROBE=${ffprobe}`,
    '',
  ].join('\n');

  return `${existing}${separator}${added}`;
};

export type { EnvFileWithFfmpegOptions };

export { envFileWithFfmpeg };
