const TIMING = /^((?:\d+:)?\d{1,2}:\d{2}\.\d{1,3})\s+-->\s+((?:\d+:)?\d{1,2}:\d{2}\.\d{1,3})(.*)$/;

/**
 * Reads a WebVTT timestamp as a number of seconds, accepting both the `hh:mm:ss.mmm` and `mm:ss.mmm`
 * forms the format allows by folding each part in from the left.
 *
 * @param stamp - The timestamp as it appears in the file.
 * @returns The position in seconds.
 */
const readTimestamp = (stamp: string): number => {
  const parts = stamp.split(':').map((part) => Number.parseFloat(part));

  return parts.reduce((total, part) => total * 60 + part, 0);
};

/**
 * Writes a number of seconds back as the `hh:mm:ss.mmm` timestamp WebVTT requires, padded so that
 * every cue in a file is the same width. A negative position is written as the start of the file
 * rather than as a negative time, which no player would accept.
 *
 * @param seconds - The position to write.
 * @returns The timestamp as WebVTT spells it.
 */
const writeTimestamp = (seconds: number): string => {
  const whole = Math.max(seconds, 0);
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const rest = whole % 60;

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${rest
    .toFixed(3)
    .padStart(6, '0')}`;
};

/**
 * Moves every cue in a subtitle file so it lines up with a stream that begins partway into the film,
 * which is what a session started at a resume point delivers. Cues that would fall before the new
 * beginning are dropped along with their text, since a cue at a negative time is a cue no player
 * will show and some will choke on.
 *
 * @param content - The subtitle file as WebVTT.
 * @param seconds - How far into the film the stream begins.
 * @returns The same file with its cues moved back, and anything before the start removed.
 */
const shiftWebVtt = (content: string, seconds: number): string => {
  if (seconds === 0) {
    return content;
  }

  const lines = content.split(/\r?\n/);
  const kept: string[] = [];
  let isDropping = false;

  for (const line of lines) {
    const timing = TIMING.exec(line);

    if (timing === null) {
      if (!isDropping) {
        kept.push(line);
      }

      continue;
    }

    const [, from = '0', to = '0', settings = ''] = timing;
    const start = readTimestamp(from) - seconds;
    const end = readTimestamp(to) - seconds;

    isDropping = end <= 0;

    if (!isDropping) {
      kept.push(`${writeTimestamp(start)} --> ${writeTimestamp(end)}${settings}`);
    } else if (kept.at(-1) === '') {
      kept.pop();
    }
  }

  return kept.join('\n');
};

export { shiftWebVtt, readTimestamp, writeTimestamp };
