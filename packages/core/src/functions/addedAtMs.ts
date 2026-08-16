/**
 * Reads the moment an item was added as a number, for sorting. Anything unparseable sorts as the
 * beginning of time rather than throwing, so one bad row cannot take a whole library listing down.
 *
 * @param addedAt - When it was added, as the catalogue stores it.
 * @returns That moment in milliseconds, or zero where it cannot be read.
 */
const addedAtMs = (addedAt: string): number => {
  const parsed = Date.parse(addedAt);

  return Number.isNaN(parsed) ? 0 : parsed;
};

export { addedAtMs };
