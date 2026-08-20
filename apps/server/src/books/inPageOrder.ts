/**
 * Puts the pages of an archive into the order somebody reads them.
 *
 * The order an archive lists its contents in is the order they were written into it, which is not
 * the order they are read in — the volumes this was built against list their pages shuffled, so a
 * reader trusting the archive would open on page ninety.
 *
 * Compared as a person would rather than as bytes: `p9` before `p10`, which sorting by character
 * gets backwards, and which matters because not every archive pads its numbers. The comparison is
 * the same one a file manager uses.
 *
 * @param names - The names of the pages, in whatever order they were found.
 * @returns The same names, in reading order.
 */
const inPageOrder = (names: readonly string[]): string[] =>
  [...names].sort((one, other) => one.localeCompare(other, 'en', { numeric: true }));

export { inPageOrder };
