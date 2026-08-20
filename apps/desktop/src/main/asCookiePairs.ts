type CookiePair = { name: string; value: string };

/**
 * Reads `Set-Cookie` lines into the name and value each one carries, dropping the attributes.
 *
 * The attributes are the server's instructions to an engine that would keep the cookie for itself,
 * and this one is being kept on that engine's behalf under attributes of our own — so `Path`,
 * `SameSite` and the rest are read off and thrown away here rather than obeyed.
 *
 * A value emptied by the server means the cookie is going, and comes back as an empty value rather
 * than being dropped, so that the caller can let go of it.
 *
 * @param lines - What the server set.
 * @returns The pairs, in the order they were set.
 */
const asCookiePairs = (lines: readonly string[]): CookiePair[] =>
  lines
    .map((line) => line.split(';')[0] ?? '')
    .map((pair) => ({ pair, at: pair.indexOf('=') }))
    .filter(({ at }) => at > 0)
    .map(({ pair, at }) => ({ name: pair.slice(0, at).trim(), value: pair.slice(at + 1).trim() }));

export type { CookiePair };

export { asCookiePairs };
