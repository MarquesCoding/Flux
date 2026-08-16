const LONGEST = 80;

/**
 * Turns a programme's title into something safe to put in an address: accents flattened, everything
 * lowered, and each run of anything else replaced by a single hyphen. Trimmed to a length that
 * keeps a URL readable, since the slug identifies nothing on its own — it sits beside an id.
 *
 * @param seriesTitle - The programme's title as a catalogue gave it.
 * @returns The title as lowercase words joined by hyphens.
 */
const showSlug = (seriesTitle: string): string =>
  seriesTitle
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, LONGEST);

export { showSlug, LONGEST };
