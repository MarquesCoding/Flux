const LEGACY_ALIGNMENTS: Record<number, number> = {
  1: 1,
  2: 2,
  3: 3,
  5: 7,
  6: 8,
  7: 9,
  9: 4,
  10: 5,
  11: 6,
};

const BOTTOM_CENTRE = 2;

/**
 * Reads where on the picture a line sits, as one of the nine positions of a numeric keypad — 1 is
 * the bottom left, 5 the middle, 9 the top right.
 *
 * SubStation Alpha numbered these differently before Advanced SubStation settled on the keypad, and
 * both spellings are still in circulation: the older one counts 1 to 3 along the bottom, 5 to 7
 * along the top and 9 to 11 through the middle. A script says which it means by which styles section
 * it carries, so the caller says which to read.
 *
 * @param raw - The alignment as the script wrote it.
 * @param isLegacy - Whether this script numbers them the older way.
 * @returns The keypad position, or null where it is not an alignment at all.
 */
const readAssAlignment = (raw: string, isLegacy: boolean): number | null => {
  const value = Number(raw.trim());

  if (!Number.isInteger(value)) {
    return null;
  }

  if (isLegacy) {
    return LEGACY_ALIGNMENTS[value] ?? null;
  }

  return value >= 1 && value <= 9 ? value : null;
};

export { BOTTOM_CENTRE, LEGACY_ALIGNMENTS, readAssAlignment };
