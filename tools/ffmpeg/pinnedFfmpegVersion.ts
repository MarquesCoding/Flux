const VERSION_PATTERN = /^ARG\s+FLUX_FFMPEG_VERSION=(?<version>\S+)\s*$/mu;

/**
 * Reads the FFmpeg version the shipped image is pinned to.
 *
 * The Dockerfile is the source of truth rather than a version file beside it, because a Dockerfile
 * ARG default cannot be read from disk. Anything else would be a second copy of the number that
 * actually ships, free to drift from it silently.
 *
 * @param dockerfile - The contents of the Dockerfile.
 * @returns The pinned version, without the leading v the release tag carries.
 * @throws If the Dockerfile no longer declares the version.
 */
const pinnedFfmpegVersion = (dockerfile: string): string => {
  const found = VERSION_PATTERN.exec(dockerfile)?.groups?.['version'];

  if (found === undefined) {
    throw new Error(
      'The Dockerfile declares no ARG FLUX_FFMPEG_VERSION, so there is no pinned version to install.',
    );
  }

  return found;
};

export { pinnedFfmpegVersion };
