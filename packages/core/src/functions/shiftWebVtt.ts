/**
 * Matches a cue's timing line and captures both ends of it.
 *
 * WebVTT allows either `hh:mm:ss.mmm` or `mm:ss.mmm`, and settings may follow
 * the second timestamp on the same line — alignment, position, size. Those are
 * kept exactly as they were: shifting a cue in time says nothing about where
 * on screen it belongs.
 */
const TIMING = /^((?:\d+:)?\d{1,2}:\d{2}\.\d{1,3})\s+-->\s+((?:\d+:)?\d{1,2}:\d{2}\.\d{1,3})(.*)$/;

/**
 * Reads a WebVTT timestamp as seconds.
 */
const readTimestamp = (stamp: string): number => {
  const parts = stamp.split(':').map((part) => Number.parseFloat(part));

  return parts.reduce((total, part) => total * 60 + part, 0);
};

/**
 * Writes seconds back as a WebVTT timestamp.
 *
 * Always with hours, which is always valid and avoids a cue crossing the hour
 * mark changing shape halfway down a file.
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
 * Moves a subtitle file's cues to match a stream that starts partway in.
 *
 * A transcode asked to begin forty minutes into a film hands the browser a
 * video whose clock starts at zero, while the subtitle file still counts from
 * the beginning of the film. Left alone, every line arrives forty minutes
 * late. Shifting the cues is what keeps them on the words.
 *
 * Cues that finish before the stream starts are dropped rather than clamped to
 * zero, where they would all pile up on the first frame.
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
      // Everything that is not a timing line belongs to whatever cue it is
      // part of, so it goes wherever that cue went.
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
      // A dropped cue leaves the blank line that preceded it behind, which
      // would stack up into a file of nothing but gaps.
      kept.pop();
    }
  }

  return kept.join('\n');
};

export { shiftWebVtt, readTimestamp, writeTimestamp };
