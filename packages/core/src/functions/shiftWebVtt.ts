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
