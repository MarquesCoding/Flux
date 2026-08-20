const MAX_AGE = /(?:^|;)\s*max-age\s*=\s*(-?\d+)/i;

const EXPIRES = /(?:^|;)\s*expires\s*=\s*([^;]+)/i;

const A_SECOND = 1000;

type CookiePair = { name: string; value: string; expiresAt: number | null };

/**
 * Reads how long the server means a cookie to last, in seconds since the epoch.
 *
 * `Max-Age` wins over `Expires` where both are given, which is what the specification says and what
 * better-auth sends. Neither means the cookie lasts as long as the application is open — and getting
 * this wrong is not a small thing: a session meant to last a week becomes one that ends when
 * somebody closes the window, and they are asked to sign in at every launch.
 *
 * @param line - The whole `Set-Cookie` line.
 * @returns When it expires, or nothing where the server did not say.
 */
const expiryOf = (line: string): number | null => {
  const age = MAX_AGE.exec(line);

  if (age?.[1] !== undefined) {
    return Date.now() / A_SECOND + Number(age[1]);
  }

  const until = EXPIRES.exec(line);
  const at = until?.[1] === undefined ? Number.NaN : Date.parse(until[1]);

  return Number.isNaN(at) ? null : at / A_SECOND;
};

/**
 * Reads `Set-Cookie` lines into the name, the value and the lifetime each one carries.
 *
 * The rest of the attributes are the server's instructions to an engine that would keep the cookie
 * for itself, and this one is being kept on that engine's behalf under attributes of our own — so
 * `Path`, `SameSite` and the others are read off and thrown away. The lifetime is not one of those:
 * it is the server saying how long somebody stays signed in, and it is obeyed.
 *
 * A value emptied by the server means the cookie is going, and comes back as an empty value rather
 * than being dropped, so that the caller can let go of it.
 *
 * @param lines - What the server set.
 * @returns The pairs, in the order they were set.
 */
const asCookiePairs = (lines: readonly string[]): CookiePair[] =>
  lines
    .map((line) => ({ line, pair: line.split(';')[0] ?? '' }))
    .map(({ line, pair }) => ({ line, pair, at: pair.indexOf('=') }))
    .filter(({ at }) => at > 0)
    .map(({ line, pair, at }) => ({
      name: pair.slice(0, at).trim(),
      value: pair.slice(at + 1).trim(),
      expiresAt: expiryOf(line),
    }));

export type { CookiePair };

export { asCookiePairs };
