const WEBVTT_HEADER = 'WEBVTT';

const SUBRIP_TIMESTAMP = /(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})/g;

const ASS_TIMESTAMP = /^(\d{1,2}):(\d{2}):(\d{2})[.:](\d{1,2})$/;

/**
 * Formats a position as the `hh:mm:ss.mmm` timestamp WebVTT insists on, every field padded to the
 * width the format requires. A position before the start of the file is written as zero.
 *
 * @param totalSeconds - The position to write, in seconds.
 * @returns The timestamp as WebVTT spells it.
 */
const formatTimestamp = (totalSeconds: number): string => {
  const safe = Math.max(0, totalSeconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = Math.floor(safe % 60);
  const milliseconds = Math.round((safe - Math.floor(safe)) * 1000);

  const pad = (value: number, width = 2): string => value.toString().padStart(width, '0');

  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}.${pad(milliseconds, 3)}`;
};

/**
 * Converts a SubRip file to WebVTT, which is the same format in all but three details: the header,
 * the comma before the milliseconds, and hours that SubRip files sometimes write with one digit. A
 * byte order mark and Windows line endings are taken off on the way through, both being things real
 * files carry and browsers refuse.
 *
 * @param source - The subtitle file as SubRip.
 * @returns The same subtitles as WebVTT.
 */
const fromSubRip = (source: string): string => {
  const body = source
    .replace(/^﻿/, '')
    .replace(/\r\n/g, '\n')
    .replace(SUBRIP_TIMESTAMP, (_, hours: string, minutes: string, seconds: string, fraction) =>
      [hours.padStart(2, '0'), minutes, `${seconds}.${String(fraction).padEnd(3, '0')}`].join(':'),
    );

  return `${WEBVTT_HEADER}\n\n${body.trim()}\n`;
};

/**
 * Reads an Advanced SubStation timestamp as a number of seconds. That format counts hundredths
 * rather than thousandths and pads nothing, so `0:00:01.5` means a second and a half.
 *
 * @param value - The timestamp as the script wrote it.
 * @returns The position in seconds, or null where the line was not a timestamp at all.
 */
const readAssTimestamp = (value: string): number | null => {
  const match = ASS_TIMESTAMP.exec(value.trim());

  if (match === null) {
    return null;
  }

  const [, hours = '0', minutes = '0', seconds = '0', centiseconds = '0'] = match;

  return (
    Number(hours) * 3600 +
    Number(minutes) * 60 +
    Number(seconds) +
    Number(centiseconds.padEnd(2, '0')) / 100
  );
};

/**
 * Strips the styling an Advanced SubStation line carries — override blocks in braces, drawing
 * commands, and its own escapes for line breaks and hard spaces — leaving the words a viewer is
 * meant to read. WebVTT has no way to express most of it, and a browser shown the codes displays
 * them.
 *
 * @param text - The line as the script wrote it, styling and all.
 * @returns The words alone, with its line breaks turned into real ones.
 */
const stripAssMarkup = (text: string): string =>
  text
    .replace(/\{[^}]*\}/g, '')
    .replace(/\\N|\\n/g, '\n')
    .replace(/\\h/g, ' ')
    .trim();

/**
 * Converts an Advanced SubStation script to WebVTT. The format declares its own column order in a
 * `Format:` line, so that is read first and the start, end and text columns are taken from wherever
 * this particular script put them rather than from where they usually are.
 *
 * @param source - The subtitle file as Advanced SubStation or SubStation Alpha.
 * @returns The same subtitles as WebVTT, with the styling stripped.
 */
const fromAdvancedSubStation = (source: string): string => {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const cues: string[] = [];

  let startColumn = 1;
  let endColumn = 2;
  let textColumn = 9;

  for (const line of lines) {
    if (line.startsWith('Format:') && cues.length === 0) {
      const columns = line
        .slice('Format:'.length)
        .split(',')
        .map((column) => column.trim().toLowerCase());

      const start = columns.indexOf('start');
      const end = columns.indexOf('end');
      const text = columns.indexOf('text');

      startColumn = start === -1 ? startColumn : start;
      endColumn = end === -1 ? endColumn : end;
      textColumn = text === -1 ? textColumn : text;
    }

    if (!line.startsWith('Dialogue:')) {
      continue;
    }

    const fields = line.slice('Dialogue:'.length).split(',');
    const start = readAssTimestamp(fields[startColumn] ?? '');
    const end = readAssTimestamp(fields[endColumn] ?? '');
    const text = stripAssMarkup(fields.slice(textColumn).join(','));

    if (start === null || end === null || text === '') {
      continue;
    }

    cues.push(`${formatTimestamp(start)} --> ${formatTimestamp(end)}\n${text}`);
  }

  return `${WEBVTT_HEADER}\n\n${cues.join('\n\n')}${cues.length === 0 ? '' : '\n'}`;
};

/**
 * Converts a subtitle file to WebVTT, which is the only format a browser will take. A file already
 * in WebVTT is passed through, gaining the header if it was missing one; anything unrecognised is
 * treated as SubRip, that being the format most likely to be mislabelled.
 *
 * @param source - The subtitle file as it was stored.
 * @param format - What the file is meant to be, as the scanner recorded it.
 * @returns The subtitles as WebVTT.
 */
const toWebVtt = (source: string, format: string): string => {
  const normalised = format.toLowerCase();

  if (normalised === 'vtt' || normalised === 'webvtt') {
    return source.trimStart().startsWith(WEBVTT_HEADER)
      ? source
      : `${WEBVTT_HEADER}\n\n${source.trim()}\n`;
  }

  if (normalised === 'ass' || normalised === 'ssa') {
    return fromAdvancedSubStation(source);
  }

  return fromSubRip(source);
};

export { toWebVtt, fromSubRip, fromAdvancedSubStation, formatTimestamp, readAssTimestamp };
