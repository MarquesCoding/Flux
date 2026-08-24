const FRACTIONS = [
  'about the same size as the original',
  'about half the size of the original',
  'about a third of the original',
  'about a quarter of the original',
  'about a fifth of the original',
  'about a sixth of the original',
  'about a seventh of the original',
  'about an eighth of the original',
  'about a ninth of the original',
  'about a tenth of the original',
] as const;

const A_LOT_SMALLER = FRACTIONS.length;

/**
 * How a rung's size reads against the file it came from.
 *
 * A number on its own is hard to weigh. Four gigabytes is either most of a phone or nothing at all,
 * depending on what it replaced — and the comparison is the whole point of the menu, since somebody
 * opening it is choosing between these and not judging each on its own.
 *
 * It matters most for a remux, where the arithmetic is the argument: a sixty gigabyte file offered
 * at four is a fifteenth of the size, and saying so makes the case better than either figure does.
 *
 * @param bytes - What the rung would cost.
 * @param originalBytes - What the file itself costs.
 * @returns The comparison in words, or nothing where there is nothing to compare against.
 */
const compareToOriginal = (bytes: number, originalBytes: number): string | null => {
  if (bytes <= 0 || originalBytes <= 0 || bytes >= originalBytes) {
    return null;
  }

  const times = Math.round(originalBytes / bytes);

  if (times >= A_LOT_SMALLER) {
    return `a small fraction of the original — about a ${times.toString()}th`;
  }

  return FRACTIONS[times - 1] ?? null;
};

export { compareToOriginal };
