import { parseAssAlpha, parseAssColour } from './parseAssColour';
import { readAssAlignment } from './readAssAlignment';

type AssTextStyle = {
  fontFamily: string | null;
  fontSize: number | null;
  colour: string | null;
  opacity: number | null;
  isBold: boolean;
  isItalic: boolean;
  isUnderlined: boolean;
  isStruckThrough: boolean;
};

type AssOverrides = {
  style: Partial<AssTextStyle>;
  alignment: number | null;
  position: { x: number; y: number } | null;
  isReset: boolean;
};

const BOLD_FROM = 600;

const A_TAG = new RegExp(
  [
    '\\\\(?:',
    'pos\\(\\s*(?<x>-?[\\d.]+)\\s*,\\s*(?<y>-?[\\d.]+)\\s*\\)',
    '|an(?<numpad>\\d+)',
    '|alpha(?<alpha>&H[0-9a-f]+&?)',
    '|1a(?<primaryAlpha>&H[0-9a-f]+&?)',
    '|1?c(?<colour>&H[0-9a-f]+&?)',
    '|fn(?<font>[^\\\\}]*)',
    '|fs(?<size>[\\d.]+)',
    '|b(?<bold>\\d+)',
    '|i(?<italic>[01])',
    '|u(?<underline>[01])',
    '|s(?<strike>[01])',
    '|a(?<legacy>\\d+)',
    '|(?<reset>r)',
    ')',
  ].join(''),
  'gi',
);

/**
 * Reads the override block an Advanced SubStation line carries in braces, taking the parts that mean
 * something a browser can draw and ignoring the rest.
 *
 * Two kinds of instruction share the block. Most describe the lettering from that point on, and so
 * belong to the run of text that follows. Where the line sits — `\pos` and the alignments — belongs
 * to the whole line however far into it the tag appears, because a line cannot be in two places.
 *
 * Anything not understood is dropped rather than guessed at: drawing commands, rotation, animation
 * and karaoke all pass through as though they were not there, which leaves the words readable
 * instead of leaving the codes on screen.
 *
 * @param block - What was between the braces.
 * @param isLegacy - Whether this script numbers its alignments the older way.
 * @returns What the block said about the lettering, where the line goes, and whether it starts over.
 */
const parseAssOverrides = (block: string, isLegacy: boolean): AssOverrides => {
  const style: Partial<AssTextStyle> = {};

  let alignment: number | null = null;
  let position: { x: number; y: number } | null = null;
  let isReset = false;

  for (const match of block.matchAll(A_TAG)) {
    const groups = match.groups ?? {};

    if (groups['x'] !== undefined && groups['y'] !== undefined) {
      position = { x: Number(groups['x']), y: Number(groups['y']) };
    }

    if (groups['numpad'] !== undefined) {
      alignment = readAssAlignment(groups['numpad'], false) ?? alignment;
    }

    if (groups['legacy'] !== undefined) {
      alignment = readAssAlignment(groups['legacy'], isLegacy) ?? alignment;
    }

    const alpha = groups['alpha'] ?? groups['primaryAlpha'];

    if (alpha !== undefined) {
      style.opacity = parseAssAlpha(alpha) ?? style.opacity ?? null;
    }

    if (groups['colour'] !== undefined) {
      const read = parseAssColour(groups['colour']);

      if (read !== null) {
        style.colour = read.colour;

        if (read.opacity !== null) {
          style.opacity = read.opacity;
        }
      }
    }

    if (groups['font'] !== undefined && groups['font'] !== '') {
      style.fontFamily = groups['font'].trim();
    }

    if (groups['size'] !== undefined) {
      style.fontSize = Number(groups['size']);
    }

    if (groups['bold'] !== undefined) {
      const weight = Number(groups['bold']);

      style.isBold = weight === 1 || weight >= BOLD_FROM;
    }

    if (groups['italic'] !== undefined) {
      style.isItalic = groups['italic'] === '1';
    }

    if (groups['underline'] !== undefined) {
      style.isUnderlined = groups['underline'] === '1';
    }

    if (groups['strike'] !== undefined) {
      style.isStruckThrough = groups['strike'] === '1';
    }

    if (groups['reset'] !== undefined) {
      isReset = true;
    }
  }

  return { style, alignment, position, isReset };
};

export type { AssOverrides, AssTextStyle };

export { BOLD_FROM, parseAssOverrides };
