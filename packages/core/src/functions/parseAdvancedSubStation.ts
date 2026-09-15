import { parseAssColour } from './parseAssColour';
import { parseAssOverrides } from './parseAssOverrides';
import { BOTTOM_CENTRE, readAssAlignment } from './readAssAlignment';
import { readAssTimestamp } from './toWebVtt';
import type { AssTextStyle } from './parseAssOverrides';

type AssSpan = Omit<AssTextStyle, 'fontSize'> & {
  text: string;
  fontHeight: number | null;
};

type AssMargins = {
  left: number;
  right: number;
  vertical: number;
};

type AssCue = {
  from: number;
  to: number;
  spans: AssSpan[];
  alignment: number;
  position: { x: number; y: number } | null;
  margins: AssMargins;
  isSign: boolean;
};

type AssScript = {
  cues: AssCue[];
};

type NamedStyle = {
  text: AssTextStyle;
  alignment: number;
  margins: AssMargins;
};

const DEFAULT_WIDTH = 384;

const DEFAULT_HEIGHT = 288;

const A_SECTION = /^\[(?<name>.+)\]\s*$/;

const AN_OVERRIDE = /\{(?<block>[^}]*)\}/g;

const PLAIN_STYLE: AssTextStyle = {
  fontFamily: null,
  fontSize: null,
  colour: null,
  opacity: null,
  isBold: false,
  isItalic: false,
  isUnderlined: false,
  isStruckThrough: false,
};

const PLAIN_MARGINS: AssMargins = { left: 0, right: 0, vertical: 0 };

/**
 * Reads the columns a `Format:` line names, which is how these sections say what order they put
 * their fields in rather than relying on everyone agreeing.
 *
 * @param line - The `Format:` line.
 * @returns The column names, lowered, in the order they appear.
 */
const readFormat = (line: string): string[] =>
  line
    .slice(line.indexOf(':') + 1)
    .split(',')
    .map((column) => column.trim().toLowerCase());

/**
 * Takes one field out of a row by the name its section's `Format:` line gave that column.
 *
 * @param fields - The row, already split.
 * @param columns - What each column is called.
 * @param name - The column wanted.
 * @returns The field, or an empty string where this row has no such column.
 */
const fieldOf = (fields: string[], columns: string[], name: string): string => {
  const at = columns.indexOf(name);

  return at === -1 ? '' : (fields[at] ?? '').trim();
};

/**
 * Reads a `Style:` row into the lettering, alignment and margins a line naming that style starts
 * with.
 *
 * @param fields - The row, already split.
 * @param columns - What each column is called.
 * @param isLegacy - Whether this script numbers its alignments the older way.
 * @returns The style.
 */
const readStyle = (fields: string[], columns: string[], isLegacy: boolean): NamedStyle => {
  const primary = parseAssColour(fieldOf(fields, columns, 'primarycolour'));
  const size = Number(fieldOf(fields, columns, 'fontsize'));
  const font = fieldOf(fields, columns, 'fontname');

  const flag = (name: string): boolean => {
    const value = Number(fieldOf(fields, columns, name));

    return Number.isFinite(value) && value !== 0;
  };

  const margin = (name: string): number => {
    const value = Number(fieldOf(fields, columns, name));

    return Number.isFinite(value) ? value : 0;
  };

  return {
    text: {
      fontFamily: font === '' ? null : font,
      fontSize: Number.isFinite(size) && size > 0 ? size : null,
      colour: primary?.colour ?? null,
      opacity: primary?.opacity ?? null,
      isBold: flag('bold'),
      isItalic: flag('italic'),
      isUnderlined: flag('underline'),
      isStruckThrough: flag('strikeout'),
    },
    alignment: readAssAlignment(fieldOf(fields, columns, 'alignment'), isLegacy) ?? BOTTOM_CENTRE,
    margins: {
      left: margin('marginl'),
      right: margin('marginr'),
      vertical: margin('marginv'),
    },
  };
};

/**
 * Turns the escapes a script writes inside its text into the characters they stand for — its two
 * spellings of a line break, and its hard space.
 *
 * @param text - A run of text between override blocks.
 * @returns The same run, as characters.
 */
const readEscapes = (text: string): string =>
  text.replaceAll(/\\N/g, '\n').replaceAll(/\\n/g, '\n').replaceAll(/\\h/g, ' ');

/**
 * Splits a line's text into runs of one appearance each, applying the override blocks as they are
 * met.
 *
 * A block describes the lettering from where it sits to the end of the line or to the next block, so
 * a line reading `{\i1}sign{\i0} here` is three runs of which one is italic. `\r` starts over from
 * the line's own style, which is how a script ends an override without spelling out its opposite.
 *
 * @param text - The line's text column, escapes and braces and all.
 * @param base - The lettering the line's named style starts it with.
 * @param isLegacy - Whether this script numbers its alignments the older way.
 * @returns The runs, and anything the blocks said about where the whole line sits.
 */
const readSpans = (
  text: string,
  base: AssTextStyle,
  isLegacy: boolean,
): {
  spans: (AssTextStyle & { text: string })[];
  alignment: number | null;
  position: { x: number; y: number } | null;
} => {
  const spans: (AssTextStyle & { text: string })[] = [];

  let current: AssTextStyle = { ...base };
  let alignment: number | null = null;
  let position: { x: number; y: number } | null = null;
  let at = 0;

  const take = (raw: string): void => {
    const said = readEscapes(raw);

    if (said !== '') {
      spans.push({ ...current, text: said });
    }
  };

  for (const match of text.matchAll(AN_OVERRIDE)) {
    take(text.slice(at, match.index));

    const overrides = parseAssOverrides(match.groups?.['block'] ?? '', isLegacy);

    current = overrides.isReset
      ? { ...base, ...overrides.style }
      : { ...current, ...overrides.style };

    alignment = overrides.alignment ?? alignment;
    position = overrides.position ?? position;
    at = match.index + match[0].length;
  }

  take(text.slice(at));

  return { spans, alignment, position };
};

/**
 * Reads an Advanced SubStation script into lines that keep what they were dressed in.
 *
 * The format carries far more than the words: a `[V4+ Styles]` section naming the lettering a line
 * can ask for, and override blocks inside a line changing it partway. Most of that describes how a
 * line looks, and some of it — `\pos` and the alignments — describes where on the picture it goes,
 * which is the difference between a subtitle and a sign painted on a shop window.
 *
 * Positions, margins and lettering sizes are written in the script's own coordinates, which
 * `[Script Info]` declares and which are not the video's. They all come back as fractions of the
 * picture — a size of `0.0667` being a fifteenth of its height — so that whatever draws them need
 * not know what the script thought it was being shown at, and so a script written for one resolution
 * looks the same shown at another.
 *
 * A line is taken for a sign where the script put it somewhere: given a position outright, or
 * aligned anywhere other than the bottom centre where dialogue belongs. That is a structural
 * question rather than a question about what the style was called, so it survives a script whose
 * styles are named in a language nobody here reads.
 *
 * The text is the last column a script declares, and is put there so that a line containing commas
 * needs no escaping — so everything from that column on is the line, rather than that column alone.
 *
 * @param source - The script.
 * @returns Its lines.
 */
const parseAdvancedSubStation = (source: string): AssScript => {
  const styles = new Map<string, NamedStyle>();
  const cues: AssCue[] = [];

  let section = '';
  let isLegacy = false;
  let styleColumns: string[] = [];
  let eventColumns: string[] = [];
  let width = DEFAULT_WIDTH;
  let height = DEFAULT_HEIGHT;

  for (const line of source.replaceAll('\r\n', '\n').split('\n')) {
    const heading = A_SECTION.exec(line.trim());

    if (heading !== null) {
      section = (heading.groups?.['name'] ?? '').toLowerCase();
      isLegacy = section === 'v4 styles';

      continue;
    }

    if (section === 'script info') {
      const declared = /^playres([xy])\s*:\s*(\d+)/i.exec(line.trim());

      if (declared !== null) {
        const value = Number(declared[2]);

        if (value > 0) {
          if ((declared[1] ?? '').toLowerCase() === 'x') {
            width = value;
          } else {
            height = value;
          }
        }
      }

      continue;
    }

    if (line.startsWith('Format:')) {
      if (section.endsWith('styles')) {
        styleColumns = readFormat(line);
      }

      if (section === 'events') {
        eventColumns = readFormat(line);
      }

      continue;
    }

    if (line.startsWith('Style:') && styleColumns.length > 0) {
      const fields = line.slice('Style:'.length).split(',');
      const name = fieldOf(fields, styleColumns, 'name');

      if (name !== '') {
        styles.set(name.toLowerCase(), readStyle(fields, styleColumns, isLegacy));
      }

      continue;
    }

    if (!line.startsWith('Dialogue:') || eventColumns.length === 0) {
      continue;
    }

    const fields = line.slice('Dialogue:'.length).split(',');
    const from = readAssTimestamp(fieldOf(fields, eventColumns, 'start'));
    const to = readAssTimestamp(fieldOf(fields, eventColumns, 'end'));
    const textColumn = eventColumns.indexOf('text');

    if (from === null || to === null || textColumn === -1) {
      continue;
    }

    const named = styles.get(fieldOf(fields, eventColumns, 'style').toLowerCase());
    const base = named?.text ?? PLAIN_STYLE;

    const said =
      textColumn === eventColumns.length - 1
        ? fields.slice(textColumn).join(',')
        : (fields[textColumn] ?? '');

    const read = readSpans(said, base, isLegacy);

    if (read.spans.length === 0) {
      continue;
    }

    const spans = read.spans.map(({ fontSize, ...rest }) => ({
      ...rest,
      fontHeight: fontSize === null ? null : fontSize / height,
    }));

    const rowMargin = (name: string, fallback: number): number => {
      const value = Number(fieldOf(fields, eventColumns, name));

      return Number.isFinite(value) && value !== 0 ? value : fallback;
    };

    const margins = named?.margins ?? PLAIN_MARGINS;
    const alignment = read.alignment ?? named?.alignment ?? BOTTOM_CENTRE;
    const position =
      read.position === null
        ? null
        : {
            x: Math.min(Math.max(read.position.x / width, 0), 1),
            y: Math.min(Math.max(read.position.y / height, 0), 1),
          };

    cues.push({
      from,
      to,
      spans,
      alignment,
      position,
      margins: {
        left: rowMargin('marginl', margins.left) / width,
        right: rowMargin('marginr', margins.right) / width,
        vertical: rowMargin('marginv', margins.vertical) / height,
      },
      isSign: position !== null || alignment !== BOTTOM_CENTRE,
    });
  }

  return { cues };
};

export type { AssCue, AssMargins, AssScript, AssSpan };

export { DEFAULT_HEIGHT, DEFAULT_WIDTH, PLAIN_STYLE, parseAdvancedSubStation };
