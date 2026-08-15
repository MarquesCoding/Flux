/**
 * Reads when something was added, as a number that can be sorted.
 *
 * @param addedAt - The timestamp as the server wrote it.
 * @returns Milliseconds since the epoch, or zero for a date that will not parse.
 */
const addedAtMs = (addedAt: string): number => {
  const parsed = Date.parse(addedAt);

  return Number.isNaN(parsed) ? 0 : parsed;
};

export { addedAtMs };
