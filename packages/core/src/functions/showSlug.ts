const LONGEST = 80;

/**
 * What a series is called, as an address.
 */
const showSlug = (seriesTitle: string): string =>
  seriesTitle
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, LONGEST);

export { showSlug, LONGEST };
