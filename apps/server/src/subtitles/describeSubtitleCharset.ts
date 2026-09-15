import type { DecodedSubtitle } from './decodeSubtitle';

/**
 * Says what a subtitle file was read as and what decided that, for the files where anything was
 * guessed at all.
 *
 * A file read as UTF-8 is not worth reporting: either it said so with a byte order mark or it proved
 * it by decoding cleanly, and in both cases nothing was assumed. Everything else was a decision
 * Valence made on the file's behalf, and a wrong one shows up as mojibake with nothing else to
 * explain it — so the decision is said out loud where an operator can see it.
 *
 * @param decoded - What the file was read as.
 * @returns What to report, or null where nothing was guessed.
 */
const describeSubtitleCharset = (decoded: DecodedSubtitle): string | null => {
  if (decoded.decidedBy === 'bom' || decoded.decidedBy === 'utf8') {
    return null;
  }

  const why =
    decoded.decidedBy === 'language'
      ? 'from the track language'
      : 'a guess, since the file does not name its language';

  return `read as ${decoded.charset} (${why}; not valid UTF-8)`;
};

export { describeSubtitleCharset };
