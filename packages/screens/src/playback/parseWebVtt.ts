type Cue = {
  from: number;
  to: number;
  text: string;
};

const A_TIME = /(?:(\d+):)?(\d{1,2}):(\d{2})[.,](\d{1,3})/;

const AN_ARROW = '-->';

const A_TAG = /<[^>]*>/g;

/**
 * Reads a timestamp as seconds.
 *
 * @param stamp - The timestamp, as WebVTT writes it.
 * @returns The seconds it stands for, or nothing where it is not one.
 */
const secondsOf = (stamp: string): number | null => {
  const found = A_TIME.exec(stamp);

  if (found === null) {
    return null;
  }

  const [, hours, minutes, seconds, fraction] = found;

  return (
    Number(hours ?? 0) * 3600 +
    Number(minutes) * 60 +
    Number(seconds) +
    Number(`0.${fraction ?? '0'}`)
  );
};

/**
 * Reads subtitles out of a WebVTT file.
 *
 * The browser reads these itself, given a `track` element, and draws them over the video it is
 * playing. There is no video element to give one to when the operating system is doing the playing,
 * and nothing behind the page can be asked to draw the application's own subtitles — so they are
 * read here and drawn as part of the page, over the picture, like everything else the player draws.
 *
 * Only what is needed is read: when a line starts, when it ends, and what it says. Positioning hints
 * are ignored on purpose — where a line sits depends on whether the controls are up, which the file
 * cannot know and the player does.
 *
 * Markup is removed rather than rendered. These files come from whatever produced the media, which
 * is not this application and not necessarily anybody trustworthy, and a subtitle is worth reading
 * rather than executing.
 *
 * @param text - The file.
 * @returns The lines, in the order they are said.
 */
const parseWebVtt = (text: string): Cue[] => {
  const cues: Cue[] = [];

  for (const block of text.replaceAll('\r\n', '\n').split(/\n{2,}/)) {
    const lines = block.split('\n');
    const at = lines.findIndex((line) => line.includes(AN_ARROW));

    if (at === -1) {
      continue;
    }

    const [start, end] = lines[at]?.split(AN_ARROW) ?? [];
    const from = start === undefined ? null : secondsOf(start);
    const to = end === undefined ? null : secondsOf(end);

    if (from === null || to === null || to <= from) {
      continue;
    }

    const said = lines
      .slice(at + 1)
      .join('\n')
      .replaceAll(A_TAG, '')
      .trim();

    if (said !== '') {
      cues.push({ from, to, text: said });
    }
  }

  return cues;
};

/**
 * Finds what is being said at a moment.
 *
 * @param cues - The lines, as they were read.
 * @param atSeconds - Where playback is up to.
 * @returns What is said then, or nothing where nobody is speaking.
 */
const cueAt = (cues: readonly Cue[], atSeconds: number): Cue | null =>
  cues.find((cue) => atSeconds >= cue.from && atSeconds < cue.to) ?? null;

export type { Cue };

export { cueAt, parseWebVtt, secondsOf };
