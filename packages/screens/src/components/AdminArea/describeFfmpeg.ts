const REPORTED_VERSION = /ffmpeg version (?<version>\S+)/u;

const OUR_BUILD = /-(?:Valence|Valence)$/u;

const LONGEST_UNPARSED = 24;

/**
 * Names the FFmpeg the media service is running, and says whose build it is.
 *
 * Our own build stamps its name into the version through `--extra-version`, so the two can be told
 * apart without asking the transcoder anything further. Both names are matched: the binaries already
 * fetched and already in containers say `-Valence`, and will go on saying it until they are rebuilt.
 * Recognising only the new one would quietly reclassify every existing build as a stranger. Worth telling apart: a machine that fell
 * back to whatever was on PATH keeps working and loses the filters that hold frames on the device,
 * which is invisible from a dashboard that calls every build the same thing.
 *
 * @param reported - What the transcoder said FFmpeg calls itself, or null where it never answered.
 * @returns The build's name and version, trimmed of the paragraph of configuration that follows it.
 */
const describeFfmpeg = (reported: string | null): string => {
  if (reported === null) {
    return 'ffmpeg unknown';
  }

  const version = REPORTED_VERSION.exec(reported)?.groups?.['version'];

  if (version === undefined) {
    return `ffmpeg ${reported.slice(0, LONGEST_UNPARSED)}`;
  }

  return OUR_BUILD.test(version)
    ? `valence-ffmpeg ${version.replace(OUR_BUILD, '')}`
    : `ffmpeg ${version}`;
};

export { describeFfmpeg };
