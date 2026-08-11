/**
 * The only subtitle format a browser renders.
 */
const WEBVTT_HEADER = 'WEBVTT';

const SUBRIP_TIMESTAMP = /(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})/g;

const ASS_TIMESTAMP = /^(\d{1,2}):(\d{2}):(\d{2})[.:](\d{1,2})$/;

/**
 * Formats seconds as the `hh:mm:ss.mmm` `WebVTT` insists on.
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
 * Converts a SubRip file to `WebVTT`.
 *
 * The two formats are near identical: the differences are a header, a comma
 * where `WebVTT` wants a full stop, and cue numbers `WebVTT` ignores. Doing
 * this here rather than through ffmpeg keeps a text conversion a text
 * conversion, with no process to spawn and nothing to cache.
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
 * Reads an Advanced SubStation timestamp as seconds.
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
 * Strips the drawing and styling codes an Advanced SubStation line carries.
 *
 * Override blocks in braces position, rotate, animate and recolour text. None
 * of it survives the trip to `WebVTT`, and Flux styles captions to the
 * viewer's own preference anyway.
 */
const stripAssMarkup = (text: string): string =>
  text
    .replace(/\{[^}]*\}/g, '')
    .replace(/\\N|\\n/g, '\n')
    .replace(/\\h/g, ' ')
    .trim();

/**
 * Converts an Advanced SubStation script to `WebVTT`.
 *
 * Only the dialogue survives: positioning, fonts and colours defined by the
 * script are dropped, because `WebVTT` cannot express most of them and a
 * viewer's own caption settings should win regardless.
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
    // Text is last because dialogue itself may contain commas, so the field
    // cannot be split on them like the others.
    const text = stripAssMarkup(fields.slice(textColumn).join(','));

    if (start === null || end === null || text === '') {
      continue;
    }

    cues.push(`${formatTimestamp(start)} --> ${formatTimestamp(end)}\n${text}`);
  }

  return `${WEBVTT_HEADER}\n\n${cues.join('\n\n')}${cues.length === 0 ? '' : '\n'}`;
};

/**
 * Converts a subtitle file to `WebVTT`.
 *
 * A file already in `WebVTT` is passed through, gaining only the header if it
 * somehow lacks one.
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

export {
  toWebVtt,
  fromSubRip,
  fromAdvancedSubStation,
  formatTimestamp,
  readAssTimestamp,
  stripAssMarkup,
};
